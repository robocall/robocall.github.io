function normalize(color) {
  const magnitude = Math.sqrt(color.r * color.r + color.g * color.g + color.b * color.b);
  if (magnitude === 0) return { r: 0, g: 0, b: 0 };
  return {
    r: color.r / magnitude,
    g: color.g / magnitude,
    b: color.b / magnitude
  };
}

function dotRGB(a, b) {
  const aNorm = normalize(a);
  const bNorm = normalize(b);
  return aNorm.r * bNorm.r + aNorm.g * bNorm.g + aNorm.b * bNorm.b;
}

// Vector map canvas (R/G space only, b=0)
const vectorCanvas = document.getElementById("vectorMap");
const vectorCtx = vectorCanvas.getContext("2d");
const vectorSVG = document.getElementById("vectorSVG");
const exampleDisplay = document.getElementById("exampleDisplay");
const ns = "http://www.w3.org/2000/svg";
let currentVectors = [];

function drawVectorMap() {
  // Clear canvas
  vectorCtx.clearRect(0, 0, vectorCanvas.width, vectorCanvas.height);

  // Draw the full r/g color map (b=0)
  for (let r = 0; r < 256; r++) {
    for (let g = 0; g < 256; g++) {
      vectorCtx.fillStyle = `rgb(${r}, ${g}, 0)`;
      vectorCtx.fillRect(r, 255 - g, 1, 1); // Flip Y axis so (0,0) is bottom-left
    }
  }

  // Clear SVG
  vectorSVG.innerHTML = '';

  // Draw vectors as SVG
  currentVectors.forEach((vector) => {
    const { r, g, label, color } = vector;
    const scale = 0.92; // Scale down to keep vectors away from edges
    const originX = 0;
    const originY = 255;
    // Scale from origin: (0, 255) is bottom-left
    const screenX = r * scale;
    const screenY = 255 - (g * scale); // g increases upward, so subtract from 255

    // Create SVG line
    const line = document.createElementNS(ns, "line");
    line.setAttribute("x1", originX);
    line.setAttribute("y1", originY);
    line.setAttribute("x2", screenX);
    line.setAttribute("y2", screenY);
    line.setAttribute("stroke", "#FFFFFF");
    line.setAttribute("stroke-width", "3");
    line.setAttribute("stroke-linecap", "round");
    vectorSVG.appendChild(line);

    // Create circle at the end of vector
    const circle = document.createElementNS(ns, "circle");
    circle.setAttribute("cx", screenX);
    circle.setAttribute("cy", screenY);
    circle.setAttribute("r", "6");
    circle.setAttribute("fill", "#FFFFFF");
    circle.setAttribute("stroke", "#000000");
    circle.setAttribute("stroke-width", "2");
    vectorSVG.appendChild(circle);
  });
}

// Example 1: Red and Green vectors
document.getElementById("example1").addEventListener("click", () => {
  const redVector = { r: 255, g: 30, b: 0 };
  const greenVector = { r: 40, g: 255, b: 0 };
  const dot = dotRGB(redVector, greenVector);

  currentVectors = [
    { r: 255, g: 30, label: "Red", color: "rgb(255, 30, 0)" },
    { r: 40, g: 255, label: "Green", color: "rgb(40, 255, 0)" }
  ];
  drawVectorMap();

  // Display red text on green background and dot product
  exampleDisplay.innerHTML = `
    <div style="background-color: rgb(40, 255, 0); color: rgb(255, 30, 0); padding: 10px; display: inline-block; margin-right: 20px;">
      Red text on green background
    </div>
    <div style="padding: 10px; display: inline-block;">
      <strong>Normalized Dot Product:</strong> ${dot.toFixed(4)}
    </div>
  `;
});

// Example 2: Bright yellow and very dark
document.getElementById("example2").addEventListener("click", () => {
  const yellowVector = { r: 255, g: 255, b: 0 };
  const darkVector = { r: 15, g: 45, b: 0 };
  const dot = dotRGB(yellowVector, darkVector);

  currentVectors = [
    { r: 255, g: 255, label: "Yellow", color: "rgb(255, 255, 0)" },
    { r: 15, g: 45, label: "Dark", color: "rgb(15, 45, 0)" }
  ];
  drawVectorMap();

  // Display yellow text on dark background and dot product
  exampleDisplay.innerHTML = `
    <div style="background-color: rgb(15, 45, 0); color: rgb(255, 255, 0); padding: 10px; display: inline-block; margin-right: 20px;">
      Yellow text on dark background
    </div>
    <div style="padding: 10px; display: inline-block;">
      <strong>Normalized Dot Product:</strong> ${dot.toFixed(4)}
    </div>
  `;
});

// Example 3: Two very similar reds
document.getElementById("example3").addEventListener("click", () => {
  const red1 = { r: 255, g: 25, b: 0 };
  const red2 = { r: 255, g: 35, b: 0 };
  const dot = dotRGB(red1, red2);

  currentVectors = [
    { r: 255, g: 25, label: "Red 1", color: "rgb(255, 25, 0)" },
    { r: 255, g: 35, label: "Red 2", color: "rgb(255, 35, 0)" }
  ];
  drawVectorMap();

  // Display text example and dot product
  exampleDisplay.innerHTML = `
    <div style="background-color: rgb(255, 35, 0); color: rgb(255, 25, 0); padding: 10px; display: inline-block; margin-right: 20px;">
      Red text on red background
    </div>
    <div style="padding: 10px; display: inline-block;">
      <strong>Normalized Dot Product:</strong> ${dot.toFixed(4)}
    </div>
  `;
});

// Example 4: Two dark vectors with low dot product but poor contrast
document.getElementById("example4").addEventListener("click", () => {
  const dark1 = { r: 30, g: 5, b: 0 };
  const dark2 = { r: 5, g: 30, b: 0 };
  const dot = dotRGB(dark1, dark2);

  currentVectors = [
    { r: 30, g: 5, label: "Dark 1", color: "rgb(30, 5, 0)" },
    { r: 5, g: 30, label: "Dark 2", color: "rgb(5, 30, 0)" }
  ];
  drawVectorMap();

  // Display text example and dot product
  exampleDisplay.innerHTML = `
    <div style="background-color: rgb(5, 30, 0); color: rgb(30, 5, 0); padding: 10px; display: inline-block; margin-right: 20px;">
      Dark text on dark background
    </div>
    <div style="padding: 10px; display: inline-block;">
      <strong>Normalized Dot Product:</strong> ${dot.toFixed(4)}
    </div>
  `;
});

// Initial draw
drawVectorMap();


const ball_radius = 26;
const ball_speed_x = 5;
const ball_speed_y = 3;

function bouncingBallSketch(
  parentId,
  canvasW,
  canvasH,
  useHeightForBottom,
  matchPostWidth,
) {
  return (p) => {
    let ball_position_x, ball_position_y, ball_velocity_x, ball_velocity_y;

    const syncPostWidth = () => {
      const wrap = document.getElementById(parentId);
      if (!wrap) return;
      const w = wrap.clientWidth;
      if (w > 0) p.resizeCanvas(w, canvasH);
    };

    p.setup = () => {
      const wrap = document.getElementById(parentId);
      const w = matchPostWidth ? wrap.clientWidth || 400 : canvasW;
      p.createCanvas(w, canvasH).parent(parentId);
      ball_position_x = 133;
      ball_position_y = matchPostWidth ? 80 : 100;
      ball_velocity_x = ball_speed_x;
      ball_velocity_y = ball_speed_y;

      if (matchPostWidth) {
        syncPostWidth();
        window.addEventListener("load", syncPostWidth);
        window.addEventListener("resize", syncPostWidth);
      }
    };

    p.windowResized = () => {
      if (matchPostWidth) syncPostWidth();
    };

    p.draw = () => {
      p.background(30, 32, 36);

      ball_position_x += ball_velocity_x;
      ball_position_y += ball_velocity_y;

      if (ball_position_x + ball_radius > p.width || ball_position_x - ball_radius < 0) {
        ball_velocity_x *= -1;
      }

      const bottomEdge = useHeightForBottom ? p.height : p.width;
      if (ball_position_y + ball_radius > bottomEdge || ball_position_y - ball_radius < 0) {
        ball_velocity_y *= -1;
      }

      p.fill(249, 145, 57);
      p.noStroke();
      p.circle(ball_position_x, ball_position_y, ball_radius * 2);
    };
  };
}

new p5(bouncingBallSketch("canvas-wrap-square", 280, 280, false, false));
new p5(bouncingBallSketch("canvas-wrap-buggy", 600, 200, false, false));

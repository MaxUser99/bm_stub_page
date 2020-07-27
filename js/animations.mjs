import { Renderer, Vec2, Vec4, Flowmap, Geometry, Texture, Program, Mesh } from './mjs/index.mjs';

const imgSize = [1080, 1920];
// const imgSize = [1920, 1080];

const renderer = new Renderer({ dpr: 2 });
const gl = renderer.gl;
document.body.appendChild(gl.canvas);

let aspect = 1;
const mouse = new Vec2(-1);
const velocity = new Vec2();
const flowmap = new Flowmap(gl);
const geometry = new Geometry(gl, {
  position: {
    size: 2,
    data: new Float32Array([-1, -1, 3, -1, -1, 3])
  },
  uv: { size: 2, data: new Float32Array([0, 0, 2, 0, 0, 2]) }
});

const texture = initializeTexture();
const program = initializeProgram(gl, texture, flowmap);
const mesh = new Mesh(gl, { geometry, program });

window.addEventListener('resize', resize, false);
if ("ontouchstart" in window) {
  window.addEventListener("touchstart", updateMouse, false);
  window.addEventListener("touchmove", updateMouse, { passive: false });
} else {
  window.addEventListener("mousemove", updateMouse, false);
}

resize();
requestAnimationFrame(update);

// functions
function update(t) {
  requestAnimationFrame(update);
  if (!velocity.needsUpdate) {
    mouse.set(-1);
    velocity.set(0);
  }
  velocity.needsUpdate = false;

  flowmap.aspect = aspect;
  flowmap.mouse.copy(mouse);
  flowmap.velocity.lerp(velocity, velocity.len ? 0.15 : 0.1);
  flowmap.update();
  program.uniforms.uTime.value = t * 0.01;
  renderer.render({ scene: mesh });
}

let lastTime;
const lastMouse = new Vec2();
function updateMouse(e) {
  e.preventDefault();
  if (e.changedTouches && e.changedTouches.length) {
    e.x = e.changedTouches[0].pageX;
    e.y = e.changedTouches[0].pageY;
  }
  if (e.x === undefined) {
    e.x = e.pageX;
    e.y = e.pageY;
  }
  mouse.set(e.x / gl.renderer.width, 1.0 - e.y / gl.renderer.height);

  if (!lastTime) {
    lastTime = performance.now();
    lastMouse.set(e.x, e.y);
  }

  const deltaX = e.x - lastMouse.x;
  const deltaY = e.y - lastMouse.y;
  lastMouse.set(e.x, e.y);

  const time = performance.now();
  const delta = (time - lastTime) || 10.4;
  lastTime = time;
  velocity.x = deltaX / delta;
  velocity.y = deltaY / delta;
  velocity.needsUpdate = true;
}

function getZT(imgWidth, imgHeight) {
  let a1, a2;
  const imageAspect = imgWidth / imgHeight;
  if (window.innerHeight / window.innerWidth < imageAspect) {
    a1 = 1;
    a2 = window.innerHeight / window.innerWidth / imageAspect;
  } else {
    a1 = (window.innerWidth / window.innerHeight)  * imageAspect;
    a2 = 1;
  }
  return [a1, a2];
}


function resize() {
  const [a1, a2] = getZT(...imgSize);

  mesh.program.uniforms.res.value = new Vec4(
    window.innerWidth,
    window.innerHeight,
    a1,
    a2
  );
  renderer.setSize(window.innerWidth, window.innerHeight);
  aspect = window.innerWidth / window.innerHeight;
}

function initializeTexture() {
  const texture = new Texture(gl, {
    minFilter: gl.LINEAR,
    magFilter: gl.LINEAR
  });

  const img = new Image();
  img.onload = () => (texture.image = img);
  img.crossOrigin = "Anonymous";
  img.src = "./assets/background.png";

  return texture;
}

function initializeProgram(gl, texture, flowmap) {
  const vertex = `
    attribute vec2 uv;
    attribute vec2 position;

    varying vec2 vUv;

    void main() {
        vUv = uv;
        gl_Position = vec4(position, 0, 1);
    }
  `;

  const fragment = `
    precision highp float;
    precision highp int;
    uniform sampler2D tWater;
    uniform sampler2D tFlow;
    uniform float uTime;
    varying vec2 vUv;
    uniform vec4 res;

    void main() {
      // R and G values are velocity in the x and y direction
      // B value is the velocity length
      vec3 flow = texture2D(tFlow, vUv).rgb;

      vec2 uv = .5 * gl_FragCoord.xy / res.xy ;
      vec2 myUV = (uv - vec2(0.5))*res.zw + vec2(0.5);
      myUV -= flow.xy * (0.15 * 0.7);

      vec3 tex = texture2D(tWater, myUV).rgb;

      gl_FragColor = vec4(tex.r, tex.g, tex.b, 1.0);
    }
  `;
  const [a1, a2] = getZT(...imgSize);
  return new Program(gl, {
    vertex,
    fragment,
    uniforms: {
      uTime: { value: 0 },
      tWater: { value: texture },
      res: { value: new Vec4(window.innerWidth, window.innerHeight, a1, a2) },
      img: { value: new Vec2(imgSize[0], imgSize[1]) },
      tFlow: flowmap.uniform
    }
  });
}


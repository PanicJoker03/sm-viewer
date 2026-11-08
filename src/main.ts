import { render, roomAt } from './render';

const canvas = document.getElementById('map') as HTMLCanvasElement;
const scale = 0.6;
render(canvas, scale);

// click a room to see its id in the console
canvas.addEventListener('click', (e) => {
  const r = canvas.getBoundingClientRect();
  const room = roomAt((e.clientX - r.left) / scale, (e.clientY - r.top) / scale);
  console.log(room?.id ?? 'no room');
});

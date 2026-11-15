/* Fireworks night-sky background (canvas). Usage: Fireworks.start(canvas, {intensity}) */
(function () {
  const COLORS = [
    [255, 200, 61], [255, 90, 95], [255, 140, 40], [90, 220, 255], [190, 120, 255], [110, 255, 160], [255, 120, 220], [255, 255, 255],
  ];
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[(Math.random() * a.length) | 0];

  function start(canvas, opts) {
    opts = opts || {};
    const ctx = canvas.getContext('2d');
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    let W = 0, H = 0, dpr = 1;
    let rockets = [], sparks = [], stars = [];
    let last = performance.now(), nextLaunch = 0, running = true;
    const intensity = opts.intensity || 1;
    const MAX_SPARKS = 900;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = Array.from({ length: Math.round((W * H) / 9000) }, () => ({
        x: Math.random() * W, y: Math.random() * H * 0.85, r: rand(0.3, 1.4), t: rand(0, 6.28), s: rand(0.5, 2),
      }));
    }

    function launch(x) {
      const tx = x !== undefined ? x : rand(W * 0.08, W * 0.92);
      rockets.push({
        x: rand(W * 0.3, W * 0.7), y: H + 10, tx, ty: rand(H * 0.12, H * 0.84),
        c: pick(COLORS), kind: pick(['peony', 'peony', 'ring', 'willow', 'heart', 'double']), p: 0,
      });
    }

    function burst(x, y, c, kind) {
      const n = kind === 'willow' ? 70 : kind === 'ring' ? 56 : kind === 'heart' ? 70 : 85;
      const speed = rand(2.2, 4);
      for (let i = 0; i < n && sparks.length < MAX_SPARKS; i++) {
        let vx, vy, a = (i / n) * Math.PI * 2, s = speed;
        if (kind === 'peony' || kind === 'double') { a = rand(0, 6.28); s = speed * Math.sqrt(Math.random()); vx = Math.cos(a) * s; vy = Math.sin(a) * s; }
        else if (kind === 'ring') { vx = Math.cos(a) * speed; vy = Math.sin(a) * speed; }
        else if (kind === 'heart') {
          const t = a;
          vx = (16 * Math.pow(Math.sin(t), 3)) / 16 * speed;
          vy = (-(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 16) * speed;
        } else { a = rand(0, 6.28); s = speed * rand(0.6, 1.1); vx = Math.cos(a) * s; vy = Math.sin(a) * s; }
        sparks.push({ x, y, vx, vy, c, life: 1, decay: kind === 'willow' ? rand(0.004, 0.008) : rand(0.009, 0.018), g: kind === 'willow' ? 0.035 : 0.045, tw: Math.random() < 0.25 });
      }
      if (kind === 'double') {
        const c2 = pick(COLORS);
        for (let i = 0; i < 40 && sparks.length < MAX_SPARKS; i++) {
          const a = (i / 40) * 6.28;
          sparks.push({ x, y, vx: Math.cos(a) * speed * 0.45, vy: Math.sin(a) * speed * 0.45, c: c2, life: 1, decay: rand(0.012, 0.02), g: 0.04, tw: false });
        }
      }
    }

    function frame(now) {
      if (!running) return;
      const dt = Math.min(2.5, (now - last) / 16.67); last = now;

      // fade trails
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';

      // stars
      for (const s of stars) {
        s.t += 0.02 * s.s;
        ctx.fillStyle = 'rgba(255,255,255,' + (0.25 + 0.35 * Math.sin(s.t) ** 2) + ')';
        ctx.fillRect(s.x, s.y, s.r, s.r);
      }

      if (now > nextLaunch && !reduce) {
        launch();
        if (Math.random() < 0.45 * intensity) setTimeout(launch, rand(100, 400));
        nextLaunch = now + rand(450, 1200) / intensity;
      }

      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        r.p += 0.018 * dt;
        const e = 1 - Math.pow(1 - Math.min(r.p, 1), 2);
        const nx = r.x + (r.tx - r.x) * 0.05 * dt, ny = r.y + (r.ty - r.y) * 0.045 * dt;
        ctx.strokeStyle = 'rgba(255,230,170,0.9)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.lineTo(nx, ny); ctx.stroke();
        r.x = nx; r.y = ny;
        if (Math.abs(r.ty - r.y) < 12 || e >= 1) { burst(r.x, r.y, r.c, r.kind); rockets.splice(i, 1); }
      }

      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.vx *= 0.985; s.vy = s.vy * 0.985 + s.g * dt;
        s.x += s.vx * dt; s.y += s.vy * dt; s.life -= s.decay * dt;
        if (s.life <= 0) { sparks.splice(i, 1); continue; }
        const a = s.tw ? s.life * (0.5 + Math.random() * 0.5) : s.life;
        ctx.fillStyle = 'rgba(' + s.c[0] + ',' + s.c[1] + ',' + s.c[2] + ',' + a.toFixed(2) + ')';
        ctx.beginPath(); ctx.arc(s.x, s.y, 1.6 * s.life + 0.4, 0, 6.28); ctx.fill();
      }
      requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) running = false;
      else if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
    });
    if (reduce) { // static: a few frozen bursts
      for (let i = 0; i < 4; i++) { burst(rand(W * 0.15, W * 0.85), rand(H * 0.15, H * 0.45), pick(COLORS), 'peony'); }
      for (let k = 0; k < 40; k++) frame(performance.now());
      running = false;
    } else requestAnimationFrame(frame);

    // click anywhere on the background to fire a rocket
    return { launch, burst: (x, y) => burst(x, y, pick(COLORS), pick(['peony', 'ring', 'heart'])) };
  }
  window.Fireworks = { start };
})();

// Hero: an ASCII wave field with my name (name-art.js) drawn into it.
(() => {
	const canvas = document.getElementById('ascii');
	const clearEls = document.querySelectorAll('[data-clear]');
	const ctx = canvas.getContext('2d');
	const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

	const RAMP = ' .,:;-=+*%#@';
	const GLITCH = '01<>/\\{}[]#$%&*+=?';
	// Colors live in style.css so the hero and the page share one palette.
	const css = getComputedStyle(document.documentElement);
	const v = (name) => css.getPropertyValue(name).trim();
	const COLORS = {
		bg: v('--hero-bg'),
		wave: [v('--hero-wave-1'), v('--hero-wave-2'), v('--hero-wave-3')],
		ripple: v('--hero-ripple'),
		name: v('--hero-name'),
		nameEdge: v('--hero-name-edge'),
		shine: v('--hero-shine'),
	};
	const REVEAL_MS = 650;

	let W, H, cw, ch, cols, rows, font;
	let mask = new Float32Array(0);
	let artRows = [];
	const art = { x: 0, y: 0, cell: 0, line: 0, font: '' };
	let clear = new Uint8Array(0);
	let noise = new Float32Array(0);
	let reveal = reduce ? 1 : 0;
	let revealStart = null;
	const mouse = { x: -1e4, y: -1e4 };
	let last = 0;
	let visible = true;
	const t0 = performance.now();

	function layout() {
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		W = canvas.clientWidth;
		H = canvas.clientHeight;
		canvas.width = W * dpr;
		canvas.height = H * dpr;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		const size = Math.max(9, Math.min(15, W / 95));
		font = `${size}px "Space Mono", monospace`;
		ctx.font = font;
		ctx.textBaseline = 'top';
		cw = ctx.measureText('M').width;
		ch = size * 1.25;
		cols = Math.ceil(W / cw);
		rows = Math.ceil(H / ch);
		noise = new Float32Array(cols * rows).map((_, i) => {
			const s = Math.sin(i * 12.9898) * 43758.5453;
			return s - Math.floor(s);
		});
		buildMask();
		buildClear();
	}

	// Keep the waves out from behind the tagline and scroll hint so the text stays clean.
	function buildClear() {
		clear = new Uint8Array(cols * rows);
		const origin = canvas.getBoundingClientRect();
		clearEls.forEach((el) => {
			const r = el.getBoundingClientRect();
			const x0 = Math.max(0, Math.floor((r.left - origin.left) / cw) - 3);
			const x1 = Math.min(cols, Math.ceil((r.right - origin.left) / cw) + 3);
			const y0 = Math.max(0, Math.floor((r.top - origin.top) / ch) - 1);
			const y1 = Math.min(rows, Math.ceil((r.bottom - origin.top) / ch) + 1);
			for (let y = y0; y < y1; y++) clear.fill(1, y * cols + x0, y * cols + x1);
		});
	}

	// Characters in name-art.js become ink density, one pixel per character.
	const DENSITY = { '@': 1, '%': 0.9, '#': 0.85, '*': 0.6, '+': 0.5, '=': 0.45, '-': 0.3, ':': 0.25, '.': 0.2 };
	const artCanvas = (() => {
		const lines = (window.NAME_ART || '').split('\n');
		while (lines.length && !lines[0].trim()) lines.shift();
		while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
		const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => l.length - l.trimStart().length));
		const rowsOfArt = lines.map((l) => l.slice(indent).replace(/\s+$/, ''));
		artRows = rowsOfArt;
		const c = document.createElement('canvas');
		c.width = Math.max(1, ...rowsOfArt.map((l) => l.length));
		c.height = Math.max(1, rowsOfArt.length);
		const g = c.getContext('2d');
		const img = g.createImageData(c.width, c.height);
		rowsOfArt.forEach((l, y) => {
			for (let x = 0; x < l.length; x++) img.data[(y * c.width + x) * 4 + 3] = (DENSITY[l[x]] || 0) * 255;
		});
		g.putImageData(img, 0, 0);
		return c;
	})();

	// Place the art at its own character size so every character shows, then mark
	// the grid cells it covers so the waves stay out from under it.
	function buildMask() {
		const marginPx = Math.min(24, Math.max(10, W * 0.02));
		// Fit the art inside the hero by width and height; lines are packed a little tighter than the
		// font's natural spacing so the name can be taller.
		const LINE = 1.8;
		const usableHeight = H - Math.max(52, H * 0.07) - 150; // leave room for the tagline
		art.cell = Math.min((W - marginPx * 2) / artCanvas.width, usableHeight / (artCanvas.height * LINE), 16);
		art.line = art.cell * LINE;
		art.font = `700 ${(art.cell / 0.6).toFixed(2)}px "Space Mono", monospace`;
		art.x = marginPx;
		art.y = Math.max(52, H * 0.07);

		const off = document.createElement('canvas');
		off.width = cols;
		off.height = rows;
		const o = off.getContext('2d');
		o.filter = 'blur(1px)';
		o.drawImage(artCanvas, art.x / cw, art.y / ch, (artCanvas.width * art.cell) / cw, (artCanvas.height * art.line) / ch);
		const data = o.getImageData(0, 0, cols, rows).data;
		mask = new Float32Array(cols * rows);
		for (let i = 0; i < mask.length; i++) mask[i] = data[i * 4 + 3] / 255;
	}

	function frame(now) {
		requestAnimationFrame(frame);
		if (!visible || now - last < 33) return;
		last = now;
		draw(now);
	}

	function draw(now) {
		const t = (now - t0) / 1000;
		if (revealStart !== null && reveal < 1) reveal = Math.min(1, (performance.now() - revealStart) / REVEAL_MS);

		ctx.fillStyle = COLORS.bg;
		ctx.fillRect(0, 0, W, H);

		const mx = mouse.x / cw;
		const my = mouse.y / ch;
		const aspect = ch / cw;
		const buckets = {};
		const put = (color, c, x, y) => (buckets[color] ||= []).push(c, x, y);

		for (let y = 0; y < rows; y++) {
			for (let x = 0; x < cols; x++) {
				const dx = x - mx;
				const dy = (y - my) * aspect;
				const d = Math.sqrt(dx * dx + dy * dy);
				const ripple = reduce ? 0 : Math.exp(-d / 10) * (0.6 + 0.4 * Math.sin(d * 0.9 - t * 7));
				const ni = y * cols + x;
				const m = mask[ni];
				if (clear[ni]) continue;

				if (m > 0.08) continue;

				const wave = (Math.sin(x * 0.09 + t * 0.7) + Math.sin(y * 0.21 - t * 0.5) + Math.sin(x * 0.05 - y * 0.11 + t * 0.35) + 3) / 6;
				const v = Math.min(1, wave * wave * wave * 0.85 + ripple * 0.75);
				const idx = Math.floor(v * (RAMP.length - 1));
				if (idx === 0) continue;
				const color = ripple > wave * 0.6 && ripple > 0.15 ? COLORS.ripple : COLORS.wave[v < 0.3 ? 0 : v < 0.55 ? 1 : 2];
				put(color, RAMP[idx], x, y);
			}
		}

		ctx.font = font;
		for (const color in buckets) {
			ctx.fillStyle = color;
			const b = buckets[color];
			for (let k = 0; k < b.length; k += 3) ctx.fillText(b[k], b[k + 1] * cw, b[k + 2] * ch);
		}

		drawName(t);
	}

	function drawName(t) {
		const width = artCanvas.width;
		const names = {};
		const putName = (color, c, x, y) => (names[color] ||= []).push(c, x, y);
		const glitchRadius = 46;
		for (let r = 0; r < artRows.length; r++) {
			const line = artRows[r];
			const py = art.y + r * art.line;
			for (let x = 0; x < line.length; x++) {
				const c = line[x];
				if (c === ' ') continue;
				const px = art.x + x * art.cell;
				const n = noise[(r * 131 + x) % noise.length];
				const start = (x / width) * 0.75 + n * 0.25;
				if (reveal < start) continue;
				const near = !reduce && Math.hypot(px - mouse.x, py - mouse.y) < glitchRadius;
				if (reveal - start < 0.12 || (near && n > 0.35) || noise[(r * 131 + x + Math.floor(t * 4)) % noise.length] < 0.003) {
					putName(COLORS.nameEdge, GLITCH[Math.floor(noise[(r * 977 + x * 7 + Math.floor(t * 20)) % noise.length] * GLITCH.length)], px, py);
				} else {
					const shine = Math.sin(x * 0.03 + r * 0.25 - t * 1.4) > 0.94;
					putName(shine ? COLORS.shine : '@%#'.includes(c) ? COLORS.name : COLORS.nameEdge, c, px, py);
				}
			}
		}
		ctx.font = art.font;
		for (const color in names) {
			ctx.fillStyle = color;
			const b = names[color];
			for (let k = 0; k < b.length; k += 3) ctx.fillText(b[k], b[k + 1], b[k + 2]);
		}
	}

	window.addEventListener('pointermove', (e) => {
		const r = canvas.getBoundingClientRect();
		mouse.x = e.clientX - r.left;
		mouse.y = e.clientY - r.top;
	});
	document.addEventListener('pointerleave', () => { mouse.x = mouse.y = -1e4; });

	new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);

	let resizeTimer;
	window.addEventListener('resize', () => {
		clearTimeout(resizeTimer);
		resizeTimer = setTimeout(() => { layout(); if (reduce) draw(performance.now()); }, 120);
	});

	const fonts = document.fonts
		? Promise.race([
			document.fonts.load('14px "Space Mono"'),
			new Promise((r) => setTimeout(r, 1200)),
		])
		: Promise.resolve();

	fonts.then(() => {
		layout();
		revealStart = performance.now();
		if (reduce) draw(performance.now());
		else requestAnimationFrame(frame);
	});
})();

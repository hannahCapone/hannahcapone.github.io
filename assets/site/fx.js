// Text scramble on hover, and crayon marks that draw themselves when scrolled into view.
(() => {
	if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

	const marks = new IntersectionObserver((entries) => {
		entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-drawn'); marks.unobserve(e.target); } });
	}, { threshold: 1 });
	document.querySelectorAll('.crayon-mark').forEach((el) => marks.observe(el));
	const GLITCH = '01<>/\\{}[]#$%&*+=?';

	function scramble(el) {
		const final = el.dataset.text || (el.dataset.text = el.textContent);
		const start = performance.now();
		cancelAnimationFrame(el._raf);
		const step = (now) => {
			const p = (now - start) / 450;
			let out = '';
			for (let i = 0; i < final.length; i++) {
				const c = final[i];
				out += c === ' ' || p > i / final.length + 0.25 ? c : GLITCH[(Math.random() * GLITCH.length) | 0];
			}
			el.textContent = out;
			if (p < 1.25) el._raf = requestAnimationFrame(step);
			else el.textContent = final;
		};
		el._raf = requestAnimationFrame(step);
	}

	document.querySelectorAll('[data-scramble]').forEach((el) => {
		el.addEventListener('mouseenter', () => scramble(el));
	});
})();

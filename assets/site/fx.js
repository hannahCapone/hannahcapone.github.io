// Crayon marks that draw themselves when scrolled into view.
(() => {
	if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

	const marks = new IntersectionObserver((entries) => {
		entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-drawn'); marks.unobserve(e.target); } });
	}, { threshold: 1 });
	document.querySelectorAll('.crayon-mark').forEach((el) => marks.observe(el));
})();

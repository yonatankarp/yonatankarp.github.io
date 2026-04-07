document.addEventListener('DOMContentLoaded', function() {
    var targets = document.querySelectorAll(
        '#about, #education, #testimonial, #contact,' +
        '#client-and-work-section > .client-works-container > h2,' +
        '#client-and-work-section .row.row--padded,' +
        '#experience-list-shortcode > div > div,' +
        '.testimonial.container'
    );

    targets.forEach(function(el) {
        el.style.opacity = '0';
        el.style.transform = 'translateY(40px)';
    });

    var hero = document.querySelector('#showcase');
    if (hero) {
        hero.style.opacity = '1';
        hero.style.transform = 'none';
    }

    var animationQueue = [];
    var isAnimating = false;

    function processQueue() {
        if (animationQueue.length === 0) {
            isAnimating = false;
            return;
        }
        isAnimating = true;
        var el = animationQueue.shift();
        el.style.transition = 'opacity 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94), transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
        setTimeout(processQueue, 150);
    }

    var observer = new IntersectionObserver(function(entries) {
        var visible = entries
            .filter(function(e) { return e.isIntersecting; })
            .sort(function(a, b) { return a.boundingClientRect.top - b.boundingClientRect.top; });

        visible.forEach(function(entry) {
            animationQueue.push(entry.target);
            observer.unobserve(entry.target);
        });

        if (!isAnimating && animationQueue.length > 0) {
            processQueue();
        }
    }, {
        threshold: 0.05,
        rootMargin: '0px 0px -20px 0px'
    });

    targets.forEach(function(el) { observer.observe(el); });
});

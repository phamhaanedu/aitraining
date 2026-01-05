document.addEventListener('DOMContentLoaded', function () {

    // --- Tabs & Curriculum Switching Logic ---
    const tabBtns = document.querySelectorAll('.tab-btn');
    const solutionContents = document.querySelectorAll('.tab-content'); // Soluion Tabs
    const curriculumTracks = document.querySelectorAll('.curriculum-track'); // Curriculum Tracks

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // 1. Handle Active State for Buttons
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // 2. Determine which tab was clicked
            const tabId = btn.getAttribute('data-tab');

            // 3. Switch Solution Content
            solutionContents.forEach(c => c.classList.remove('active'));
            const targetSolution = document.getElementById(tabId + '-solution');
            if (targetSolution) {
                targetSolution.classList.add('active');
            }

            // 4. Switch Curriculum Content
            curriculumTracks.forEach(t => t.classList.remove('active'));
            curriculumTracks.forEach(t => t.style.display = 'none'); // Ensure hidden

            const targetCurriculum = document.getElementById(tabId + '-curriculum');
            if (targetCurriculum) {
                targetCurriculum.style.display = 'block'; // Show effectively
                // Small delay to allow fade-in animation if class based
                setTimeout(() => targetCurriculum.classList.add('active'), 10);
            }
        });
    });

    // --- Accordion Logic ---
    const accordionHeaders = document.querySelectorAll('.accordion-header');

    accordionHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const body = header.nextElementSibling;

            // Toggle current item
            header.classList.toggle('active');

            if (header.classList.contains('active')) {
                body.style.maxHeight = body.scrollHeight + "px";
            } else {
                body.style.maxHeight = null;
            }
        });
    });

    // --- Sticky Header Scroll Effect ---
    const header = document.querySelector('.header');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
        } else {
            header.style.boxShadow = "0 2px 4px rgba(0,0,0,0.05)";
        }
    });

    // --- Modal & Form Logic ---
    const modal = document.getElementById("register-modal");
    const closeBtn = document.querySelector(".close-modal");
    const registerBtns = document.querySelectorAll('a[href="#register"]');
    const form = document.forms['submit-to-google-sheet'];
    const msg = document.getElementById("form-msg");

    // Replace this URL with your Google Apps Script Web App URL
    const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbype4T5-vYvRq-r-6Dh5sIR3ZOUklj0rpQ2_VtRJKXnUw7JbObDtnIFOmzqxZVfsMrD/exec';

    // Open Modal
    registerBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            modal.style.display = "block";
        });
    });

    // Close Modal
    closeBtn.onclick = function () {
        modal.style.display = "none";
    }

    window.onclick = function (event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }

    // Submit Form
    if (form) {
        form.addEventListener('submit', e => {
            e.preventDefault();

            if (SCRIPT_URL.includes('AKfycbzQp...')) {
                alert('Vui lòng làm theo hướng dẫn trong file google_sheet_instructions.md để lấy URL thật!');
                return;
            }

            msg.innerHTML = "Đang gửi...";
            msg.style.color = "#0066cc";

            fetch(SCRIPT_URL, { method: 'POST', body: new FormData(form) })
                .then(response => {
                    msg.innerHTML = "Đăng ký thành công! Chúng tôi sẽ liên hệ sớm.";
                    msg.style.color = "green";
                    form.reset();
                    setTimeout(() => {
                        modal.style.display = "none";
                        msg.innerHTML = "";
                    }, 3000);
                })
                .catch(error => {
                    msg.innerHTML = "Lỗi! Vui lòng thử lại.";
                    msg.style.color = "red";
                    console.error('Error!', error.message);
                });
        });
    }

});



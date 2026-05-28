// Animated Doctor site scripts
(function(){
  // typing headline
  function typeHeadline(){ const el=document.querySelector('.typing'); if(!el) return; const text = el.dataset.text||el.textContent; el.textContent=''; let i=0; (function step(){ if(i<=text.length){ el.textContent = text.slice(0,i); i++; setTimeout(step,40 + (i%3)*10); } else { el.textContent = text; } })(); }
  typeHeadline();

  // animate stats when visible
  function animateStats(){ document.querySelectorAll('.stat').forEach(el=>{ const target = parseFloat(el.dataset.target); let cur = 0; const step = Math.max(1, target/40); const id = setInterval(()=>{ cur += step; if(cur >= target){ el.textContent = target; clearInterval(id); } else { el.textContent = Math.floor(cur); } },30); }); }
  const sEl = document.querySelector('.quick-stats'); if(sEl){ const statsObserver = new IntersectionObserver((entries)=>{ if(entries[0].isIntersecting){ animateStats(); statsObserver.unobserve(sEl); } },{threshold:0.4}); statsObserver.observe(sEl); }

  // contact form handler -> POST to backend
  const API = 'http://localhost:6000/api';

  async function loadSummary(){
    try {
      const res = await fetch(API + '/summary');
      if(!res.ok) return;
      const data = await res.json();
      const appointmentEl = document.getElementById('appointmentCount');
      if(appointmentEl){
        appointmentEl.dataset.target = data.total_appointments || 0;
        appointmentEl.textContent = data.total_appointments || 0;
      }
      const totalEl = document.getElementById('backendAppointmentTotal');
      if(totalEl){
        totalEl.textContent = data.total_appointments || 0;
      }
      const listEl = document.getElementById('recentAppointments');
      if(listEl){
        listEl.innerHTML = '';
        (data.latest_appointments || []).slice().reverse().forEach(entry => {
          const li = document.createElement('li');
          li.textContent = `${entry.name} (${entry.preferred_date || 'any date'} ${entry.preferred_time || ''})`;
          listEl.appendChild(li);
        });
        if(!listEl.children.length){
          listEl.innerHTML = '<li>No requests yet</li>';
        }
      }
    } catch (err) {
      console.warn('Summary fetch failed', err);
    }
  }

  async function loadBackendStatus(){
    const statusEl = document.getElementById('backendStatus');
    if(!statusEl) return;
    try {
      const res = await fetch(API + '/health');
      const data = await res.json();
      if(res.ok && data.status === 'ok'){
        statusEl.textContent = 'Online — backend is healthy at localhost:6000';
        statusEl.classList.remove('status-error');
        statusEl.classList.add('status-ok');
      } else {
        throw new Error(data.error || 'Backend unavailable');
      }
    } catch (err) {
      statusEl.textContent = 'Offline — start backend with python doctor_app.py';
      statusEl.classList.remove('status-ok');
      statusEl.classList.add('status-error');
    }
  }

  function updateActiveNav(){
    const sections = document.querySelectorAll('main, section');
    const navLinks = document.querySelectorAll('.nav a');
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const id = entry.target.id;
        const link = document.querySelector(`.nav a[href="#${id}"]`);
        if(link){
          link.classList.toggle('active', entry.isIntersecting);
        }
      });
    }, {threshold: 0.5});
    sections.forEach(sec => observer.observe(sec));
  }

  loadSummary();
  loadBackendStatus();
  setInterval(loadBackendStatus, 10000);
  updateActiveNav();

  document.getElementById('contactForm')?.addEventListener('submit', async function(e){
    e.preventDefault();
    const form = this;
    const submitBtn = form.querySelector('button[type="submit"]');
    const fd = new FormData(form);
    const payload = {
      name: fd.get('name'),
      phone: fd.get('phone'),
      message: fd.get('message'),
      preferred_date: fd.get('preferred_date'),
      preferred_time: fd.get('preferred_time')
    };
    // show spinner + disable
    submitBtn.disabled = true; const originalContent = submitBtn.innerHTML; submitBtn.innerHTML = '<span class="spinner"></span> Sending...';
    try {
      const res = await fetch(API + '/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        // success animation
        form.classList.add('success');
        submitBtn.innerHTML = '✓ Sent';
        if (data.warning) {
          showToast(data.warning, true);
        }
        loadSummary();
        setTimeout(()=>{ form.reset(); form.classList.remove('success'); submitBtn.innerHTML = originalContent; }, 1800);
      } else {
        showToast(data.error || 'Failed to send request', true);
      }
    } catch(err) {
      showToast('Network error — is the backend running?', true);
      console.error(err);
    } finally {
      submitBtn.disabled = false;
    }
  });

  // reveal on scroll for cards and other elements
  const revealObserver = new IntersectionObserver((entries)=>{ entries.forEach(en=>{ if(en.isIntersecting){ en.target.classList.add('visible'); revealObserver.unobserve(en.target); } }); },{threshold:0.14});
  document.querySelectorAll('.card, .about-text, .photo-card').forEach(n=>revealObserver.observe(n));

  // button ripple effect (subtle)
  document.querySelectorAll('.btn').forEach(btn=>{
    btn.addEventListener('pointerdown', (ev)=>{
      const rect = btn.getBoundingClientRect();

    
      const r = Math.max(rect.width, rect.height);
      const span = document.createElement('span');
      span.className = 'ripple';
      span.style.width = span.style.height = r + 'px';
      span.style.left = (ev.clientX - rect.left - r/2) + 'px';
      span.style.top = (ev.clientY - rect.top - r/2) + 'px';
      btn.appendChild(span);
      setTimeout(()=> span.remove(), 700);
    });
  });

  // year
  document.getElementById('year').textContent = new Date().getFullYear();

  // call button
  document.getElementById('callBtn')?.addEventListener('click', ()=>{ location.href = 'tel:8591155858'; });

  // smooth scrolling for internal links
  document.querySelectorAll('a[href^="#"]').forEach(a=>{
    a.addEventListener('click', (e)=>{
      const href = a.getAttribute('href');
      if(href && href.startsWith('#')){
        e.preventDefault();
        const el = document.querySelector(href);
        if(el) el.scrollIntoView({behavior:'smooth',block:'center'});
      }
    });
  });


})();

// small toast util
function showToast(message, isError){
  let t = document.createElement('div');
  t.className = 'toast' + (isError? ' error':'');
  t.textContent = message;
  document.body.appendChild(t);
  setTimeout(()=> t.classList.add('visible'), 50);
  setTimeout(()=>{ t.classList.remove('visible'); setTimeout(()=> t.remove(),400); }, 4000);
}

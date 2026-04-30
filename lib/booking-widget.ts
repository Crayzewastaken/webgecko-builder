export function generateBookingWidget(config: {
  jobId: string;
  businessName: string;
  timezone: string;
  services: { name: string; duration: number }[];
  primaryColor: string;
  apiBase: string;
}): string {
  const { jobId, businessName, timezone, services, primaryColor, apiBase } = config;
  const safeColor = primaryColor || "#10b981";
  const servicesJson = JSON.stringify(services);

  return `<section id="booking" style="padding:80px 20px;scroll-margin-top:80px;background:inherit;">
  <style>
    /* Booking Widget — fully self-contained, immune to site CSS */
    #booking, #booking * { box-sizing:border-box !important; }
    #booking .bw-container { max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif !important; }
    #booking .bw-heading { font-size:2rem !important;font-weight:700 !important;text-align:center !important;margin:0 0 8px !important;color:inherit !important; }
    #booking .bw-subheading { text-align:center !important;margin:0 0 40px !important;font-size:1rem !important;color:inherit !important;opacity:0.65 !important; }
    #booking .bw-section-label { font-size:0.75rem !important;text-transform:uppercase !important;letter-spacing:0.08em !important;margin:0 0 12px !important;display:block !important;color:inherit !important;opacity:0.5 !important; }
    #booking .bw-date-grid { display:grid !important;grid-template-columns:repeat(5,1fr) !important;gap:8px !important;margin-bottom:32px !important; }
    @media(max-width:480px){ #booking .bw-date-grid { grid-template-columns:repeat(4,1fr) !important; } }
    #booking .bw-date-card {
      background:#1e293b !important;border:1px solid #334155 !important;border-radius:12px !important;
      padding:12px 4px !important;text-align:center !important;cursor:pointer !important;transition:all 0.18s ease !important;
      user-select:none !important;min-height:64px !important;display:flex !important;flex-direction:column !important;
      align-items:center !important;justify-content:center !important;color:#e2e8f0 !important;
    }
    #booking .bw-date-card:hover:not(.bw-date-disabled) { border-color:${safeColor} !important;transform:translateY(-1px) !important; }
    #booking .bw-date-card.bw-date-selected { border-color:${safeColor} !important;background:${safeColor}33 !important; }
    #booking .bw-date-card.bw-date-disabled { opacity:0.3 !important;cursor:not-allowed !important; }
    #booking .bw-date-dow { font-size:0.65rem !important;text-transform:uppercase !important;letter-spacing:0.05em !important;margin-bottom:4px !important;color:#94a3b8 !important; }
    #booking .bw-date-num { font-size:1.1rem !important;font-weight:700 !important;line-height:1 !important;margin-bottom:2px !important;color:#e2e8f0 !important; }
    #booking .bw-date-mon { font-size:0.65rem !important;color:#94a3b8 !important; }
    #booking .bw-date-card.bw-date-selected .bw-date-dow,
    #booking .bw-date-card.bw-date-selected .bw-date-num,
    #booking .bw-date-card.bw-date-selected .bw-date-mon { color:${safeColor} !important; }
    #booking .bw-time-grid { display:grid !important;grid-template-columns:repeat(4,1fr) !important;gap:10px !important;margin-bottom:32px !important; }
    @media(max-width:400px){ #booking .bw-time-grid { grid-template-columns:repeat(3,1fr) !important; } }
    #booking .bw-time-btn {
      background:#1e293b !important;border:1px solid #334155 !important;border-radius:10px !important;
      padding:14px 8px !important;min-height:48px !important;text-align:center !important;font-size:0.9rem !important;
      cursor:pointer !important;transition:all 0.18s ease !important;color:#e2e8f0 !important;
    }
    #booking .bw-time-btn:hover { border-color:${safeColor} !important;color:${safeColor} !important; }
    #booking .bw-time-btn.bw-time-selected { border-color:${safeColor} !important;background:${safeColor}33 !important;color:${safeColor} !important;font-weight:600 !important; }
    #booking .bw-no-slots { text-align:center !important;padding:20px !important;background:#1e293b !important;border-radius:10px !important;margin-bottom:32px !important;color:#94a3b8 !important; }
    #booking .bw-loading { text-align:center !important;padding:20px !important;color:#94a3b8 !important; }
    #booking .bw-form-group { margin-bottom:16px !important; }
    #booking .bw-label { display:block !important;font-size:0.85rem !important;margin-bottom:6px !important;color:#94a3b8 !important; }
    #booking .bw-input,
    #booking .bw-select,
    #booking .bw-textarea {
      width:100% !important;background:#1e293b !important;border:1px solid #334155 !important;border-radius:10px !important;
      padding:14px !important;min-height:48px !important;font-size:16px !important;outline:none !important;
      transition:border-color 0.18s !important;font-family:inherit !important;color:#e2e8f0 !important;
    }
    #booking .bw-input:focus,
    #booking .bw-select:focus,
    #booking .bw-textarea:focus { border-color:${safeColor} !important; }
    #booking .bw-textarea { resize:vertical !important;min-height:90px !important; }
    #booking .bw-submit-btn {
      width:100% !important;background:${safeColor} !important;color:#ffffff !important;border:none !important;border-radius:10px !important;
      padding:16px !important;min-height:56px !important;font-size:1rem !important;font-weight:600 !important;cursor:pointer !important;
      transition:opacity 0.18s,transform 0.18s !important;margin-top:8px !important;
    }
    #booking .bw-submit-btn:hover:not(:disabled) { opacity:0.88 !important;transform:translateY(-1px) !important; }
    #booking .bw-submit-btn:disabled { opacity:0.5 !important;cursor:not-allowed !important; }
    #booking .bw-success { background:#0f1f35 !important;border:1px solid ${safeColor} !important;border-radius:12px !important;padding:28px 24px !important;text-align:center !important; }
    #booking .bw-success-icon { font-size:2.5rem !important;margin-bottom:12px !important; }
    #booking .bw-success-title { color:${safeColor} !important;font-size:1.3rem !important;font-weight:700 !important;margin:0 0 8px !important; }
    #booking .bw-success-text { font-size:0.95rem !important;margin:0 0 16px !important;color:#94a3b8 !important; }
    #booking .bw-success-detail { background:#0a1628 !important;border-radius:8px !important;padding:14px 16px !important;margin-top:12px !important;text-align:left !important; }
    #booking .bw-success-detail p { margin:4px 0 !important;font-size:0.9rem !important;color:#e2e8f0 !important; }
    #booking .bw-success-detail span { color:#64748b !important; }
    #booking .bw-error { background:rgba(239,68,68,0.12) !important;border:1px solid #ef4444 !important;border-radius:10px !important;padding:14px 16px !important;color:#f87171 !important;font-size:0.9rem !important;margin-top:12px !important; }
    #booking .bw-panel { background:#1a2740 !important;border:1px solid #334155 !important;border-radius:12px !important;padding:24px !important;margin-bottom:24px !important; }
    #booking .bw-step-indicator { display:flex !important;gap:6px !important;margin-bottom:28px !important;justify-content:center !important; }
    #booking .bw-step-dot { width:8px !important;height:8px !important;border-radius:50% !important;background:#334155 !important;transition:background 0.2s !important; }
    #booking .bw-step-dot.active { background:${safeColor} !important; }
    #booking .bw-back-btn {
      background:transparent !important;border:1px solid #334155 !important;border-radius:8px !important;
      padding:12px 16px !important;min-height:44px !important;font-size:0.85rem !important;cursor:pointer !important;
      margin-bottom:16px !important;transition:border-color 0.18s,opacity 0.18s !important;color:#94a3b8 !important;
    }
    #booking .bw-back-btn:hover { border-color:${safeColor} !important;color:${safeColor} !important; }
    #booking .bw-selected-summary { background:${safeColor}22 !important;border:1px solid ${safeColor}55 !important;border-radius:8px !important;padding:10px 14px !important;margin-bottom:20px !important;color:${safeColor} !important;font-size:0.88rem !important;font-weight:500 !important; }
  </style>

  <div class="bw-container">
    <h2 class="bw-heading">Book an Appointment</h2>
    <p class="bw-subheading">Select a date and time that works for you</p>
    <div id="bw-root"></div>
  </div>

  <script>
  (function() {
    var BW_JOB_ID = ${JSON.stringify(jobId)};
    var BW_API_BASE = ${JSON.stringify(apiBase)};
    var BW_TIMEZONE = ${JSON.stringify(timezone)};
    var BW_SERVICES = ${servicesJson};
    var DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    var state = {
      step: 1,
      selectedDate: null,
      selectedTime: null,
      availableSlots: [],
      loadingSlots: false,
      submitting: false,
      error: null,
      successData: null,
    };

    function pad(n) { return String(n).padStart(2,'0'); }
    function dateStr(d) { return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }

    function generateDates() {
      var dates = [];
      var today = new Date();
      today.setHours(0,0,0,0);
      for (var i = 0; i < 30; i++) {
        var d = new Date(today);
        d.setDate(today.getDate() + i);
        dates.push(d);
      }
      return dates;
    }

    function formatDisplayDate(d) {
      var parts = d.split('-').map(Number);
      var dt = new Date(parts[0], parts[1]-1, parts[2]);
      return DAYS[dt.getDay()] + ', ' + parts[2] + ' ' + MONTHS[parts[1]-1] + ' ' + parts[0];
    }

    function render() {
      var root = document.getElementById('bw-root');
      if (!root) return;
      if (state.step === 4 && state.successData) { root.innerHTML = renderSuccess(); return; }

      var html = '<div class="bw-step-indicator">';
      for (var s = 1; s <= 3; s++) {
        html += '<div class="bw-step-dot'+(state.step >= s ? ' active':'')+'" ></div>';
      }
      html += '</div>';
      if (state.step === 1) html += renderDateStep();
      else if (state.step === 2) html += renderTimeStep();
      else if (state.step === 3) html += renderFormStep();
      root.innerHTML = html;
      attachEventListeners();
    }

    function renderDateStep() {
      var dates = generateDates();
      var html = '<span class="bw-section-label">Select a date</span><div class="bw-date-grid">';
      dates.forEach(function(d) {
        var ds = dateStr(d);
        var sel = ds === state.selectedDate;
        html += '<div class="bw-date-card'+(sel?' bw-date-selected':'')+'" data-date="'+ds+'">' +
          '<div class="bw-date-dow">'+DAYS[d.getDay()]+'</div>' +
          '<div class="bw-date-num">'+d.getDate()+'</div>' +
          '<div class="bw-date-mon">'+MONTHS[d.getMonth()]+'</div>' +
          '</div>';
      });
      html += '</div>';
      return html;
    }

    function renderTimeStep() {
      var html = '<button class="bw-back-btn" id="bw-back-date">← Back to dates</button>';
      html += '<div class="bw-selected-summary">📅 '+formatDisplayDate(state.selectedDate)+'</div>';
      html += '<span class="bw-section-label">Select a time</span>';
      if (state.loadingSlots) {
        html += '<div class="bw-loading">Checking availability…</div>';
      } else if (state.availableSlots.length === 0) {
        html += '<div class="bw-no-slots">No availability on this date. Please choose another day.</div>';
      } else {
        html += '<div class="bw-time-grid">';
        state.availableSlots.forEach(function(slot) {
          var sel = slot === state.selectedTime;
          html += '<button class="bw-time-btn'+(sel?' bw-time-selected':'')+'" data-time="'+slot+'">'+slot+'</button>';
        });
        html += '</div>';
      }
      return html;
    }

    function renderFormStep() {
      var opts = BW_SERVICES.map(function(s) {
        return '<option value="'+escHtml(s.name)+'">'+escHtml(s.name)+'</option>';
      }).join('');
      var html = '<button class="bw-back-btn" id="bw-back-time">← Back to times</button>';
      html += '<div class="bw-selected-summary">📅 '+formatDisplayDate(state.selectedDate)+' &nbsp;·&nbsp; ⏰ '+state.selectedTime+'</div>';
      html += '<span class="bw-section-label">Your details</span><div class="bw-panel">';
      html += '<div class="bw-form-group"><label class="bw-label">Full Name *</label><input class="bw-input" id="bw-name" type="text" placeholder="Jane Smith" autocomplete="name" required /></div>';
      html += '<div class="bw-form-group"><label class="bw-label">Email *</label><input class="bw-input" id="bw-email" type="email" placeholder="jane@example.com" autocomplete="email" required /></div>';
      html += '<div class="bw-form-group"><label class="bw-label">Phone *</label><input class="bw-input" id="bw-phone" type="tel" placeholder="0400 000 000" autocomplete="tel" inputmode="tel" required /></div>';
      html += '<div class="bw-form-group"><label class="bw-label">Service *</label><select class="bw-select" id="bw-service">'+opts+'</select></div>';
      html += '<div class="bw-form-group"><label class="bw-label">ABN <span style="color:#475569;font-weight:400;font-size:0.8rem;">(optional — required for business invoices)</span></label><input class="bw-input" id="bw-abn" type="text" placeholder="XX XXX XXX XXX" inputmode="numeric" /></div>';
      html += '<div class="bw-form-group"><label class="bw-label">Message (optional)</label><textarea class="bw-textarea" id="bw-message" placeholder="Anything you\'d like us to know?"></textarea></div>';
      html += '<button class="bw-submit-btn" id="bw-submit"'+(state.submitting?' disabled':')+'>'+(state.submitting?'Confirming…':'Confirm Booking')+'</button>';
      if (state.error) html += '<div class="bw-error">'+escHtml(state.error)+'</div>';
      html += '</div>';
      return html;
    }

    function renderSuccess() {
      var sd = state.successData;
      return '<div class="bw-success">' +
        '<div class="bw-success-icon">✅</div>' +
        '<div class="bw-success-title">Booking Confirmed!</div>' +
        '<p class="bw-success-text">Check your email for a confirmation. We look forward to seeing you!</p>' +
        '<div class="bw-success-detail">' +
        '<p><span>Service: </span>'+escHtml(sd.service)+'</p>' +
        '<p><span>Date: </span>'+escHtml(sd.date)+'</p>' +
        '<p><span>Time: </span>'+escHtml(sd.time)+' ('+escHtml(sd.timezone)+')</p>' +
        '</div></div>';
    }

    function escHtml(str) {
      return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function fetchSlots(date) {
      state.loadingSlots = true;
      state.availableSlots = [];
      state.selectedTime = null;
      render();
      fetch(BW_API_BASE+'/api/availability?jobId='+encodeURIComponent(BW_JOB_ID)+'&date='+encodeURIComponent(date))
        .then(function(r){return r.json();})
        .then(function(data){state.availableSlots=data.available||[];state.loadingSlots=false;render();})
        .catch(function(){state.loadingSlots=false;state.availableSlots=[];render();});
    }

    function attachEventListeners() {
      document.querySelectorAll('#bw-root .bw-date-card:not(.bw-date-disabled)').forEach(function(el) {
        el.addEventListener('click', function() {
          state.selectedDate = this.getAttribute('data-date');
          state.step = 2;
          fetchSlots(state.selectedDate);
        });
      });
      document.querySelectorAll('#bw-root .bw-time-btn').forEach(function(el) {
        el.addEventListener('click', function() {
          state.selectedTime = this.getAttribute('data-time');
          state.step = 3;
          state.error = null;
          render();
        });
      });
      var backDate = document.getElementById('bw-back-date');
      if (backDate) backDate.addEventListener('click', function() { state.step=1; state.selectedTime=null; render(); });
      var backTime = document.getElementById('bw-back-time');
      if (backTime) backTime.addEventListener('click', function() { state.step=2; state.error=null; render(); });

      var submitBtn = document.getElementById('bw-submit');
      if (submitBtn) {
        submitBtn.addEventListener('click', function() {
          var name  = (document.getElementById('bw-name')||{}).value||'';
          var email = (document.getElementById('bw-email')||{}).value||'';
          var phone = (document.getElementById('bw-phone')||{}).value||'';
          var service=(document.getElementById('bw-service')||{}).value||'';
          var message=(document.getElementById('bw-message')||{}).value||'';
          var abn   = (document.getElementById('bw-abn')||{}).value||'';

          if (!name.trim()||!email.trim()||!phone.trim()||!service) {
            state.error='Please fill in all required fields.'; render(); return;
          }
          if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
            state.error='Please enter a valid email address.'; render(); return;
          }
          state.submitting=true; state.error=null; render();

          fetch(BW_API_BASE+'/api/book', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({
              jobId:BW_JOB_ID,
              visitorName:name.trim(),
              visitorEmail:email.trim(),
              visitorPhone:phone.trim(),
              service:service,
              date:state.selectedDate,
              time:state.selectedTime,
              timezone:BW_TIMEZONE,
              message:message.trim(),
              abn:abn.trim(),
            })
          })
          .then(function(r){return r.json().then(function(data){return{ok:r.ok,data:data};});})
          .then(function(result){
            state.submitting=false;
            if (result.ok) { state.successData=result.data.booking; state.step=4; render(); }
            else { state.error=result.data.error||'Booking failed. Please try again.'; render(); }
          })
          .catch(function(){ state.submitting=false; state.error='Network error. Please try again.'; render(); });
        });
      }
    }

    // Wire CTA buttons on the page to scroll here
    function wireCtaButtons() {
      var bookingEl = document.getElementById('booking');
      if (!bookingEl) return;
      var keywords = ['book','appointment','reserve','get started','join now','sign up','enquire','schedule','session','free trial','try free'];
      document.querySelectorAll('a,button').forEach(function(el) {
        if (el.dataset.wgCtaBound) return;
        var txt = (el.textContent||'').toLowerCase().trim();
        var href = el.getAttribute('href')||'';
        var hasKeyword = keywords.some(function(k){return txt.includes(k);});
        if (!hasKeyword) return;
        // Don't override real hrefs or existing navigateTo handlers
        if (href && href!=='#' && !href.startsWith('javascript')) return;
        if ((el.getAttribute('onclick')||'').includes('navigateTo')) return;
        el.dataset.wgCtaBound='1';
        el.addEventListener('click',function(e){e.preventDefault();bookingEl.scrollIntoView({behavior:'smooth'});});
      });
    }

    render();
    if (document.readyState==='loading') { document.addEventListener('DOMContentLoaded',wireCtaButtons); }
    else { wireCtaButtons(); }
  })();
  </script>
</section>`;
}
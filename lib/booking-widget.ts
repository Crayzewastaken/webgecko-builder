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

  return `<section id="booking" style="background:#0f1623;padding:80px 20px;">
  <style>
    #booking * { box-sizing: border-box; }
    #booking .bw-container { max-width: 600px; margin: 0 auto; }
    #booking .bw-heading {
      color: #ffffff;
      font-size: 2rem;
      font-weight: 700;
      text-align: center;
      margin: 0 0 8px;
    }
    #booking .bw-subheading {
      color: #94a3b8;
      text-align: center;
      margin: 0 0 40px;
      font-size: 1rem;
    }
    #booking .bw-section-label {
      color: #64748b;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin: 0 0 12px;
      display: block;
    }
    #booking .bw-date-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 8px;
      margin-bottom: 32px;
    }
    @media (max-width: 480px) {
      #booking .bw-date-grid { grid-template-columns: repeat(4, 1fr); }
    }
    #booking .bw-date-card {
      background: #0a0f1a;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 12px;
      padding: 10px 4px;
      text-align: center;
      cursor: pointer;
      transition: all 0.18s ease;
      user-select: none;
    }
    #booking .bw-date-card:hover:not(.bw-date-disabled) {
      border-color: ${safeColor};
      transform: translateY(-1px);
    }
    #booking .bw-date-card.bw-date-selected {
      border-color: ${safeColor};
      background: ${safeColor}18;
    }
    #booking .bw-date-card.bw-date-disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }
    #booking .bw-date-dow {
      color: #64748b;
      font-size: 0.65rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 4px;
    }
    #booking .bw-date-num {
      color: #e2e8f0;
      font-size: 1.1rem;
      font-weight: 700;
      line-height: 1;
      margin-bottom: 2px;
    }
    #booking .bw-date-mon {
      color: #64748b;
      font-size: 0.65rem;
    }
    #booking .bw-date-card.bw-date-selected .bw-date-dow,
    #booking .bw-date-card.bw-date-selected .bw-date-num,
    #booking .bw-date-card.bw-date-selected .bw-date-mon {
      color: ${safeColor};
    }
    #booking .bw-time-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 32px;
    }
    @media (max-width: 400px) {
      #booking .bw-time-grid { grid-template-columns: repeat(3, 1fr); }
    }
    #booking .bw-time-btn {
      background: #0a0f1a;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 10px;
      color: #e2e8f0;
      padding: 12px 8px;
      text-align: center;
      font-size: 0.9rem;
      cursor: pointer;
      transition: all 0.18s ease;
    }
    #booking .bw-time-btn:hover {
      border-color: ${safeColor};
      color: ${safeColor};
    }
    #booking .bw-time-btn.bw-time-selected {
      border-color: ${safeColor};
      background: ${safeColor}18;
      color: ${safeColor};
      font-weight: 600;
    }
    #booking .bw-no-slots {
      color: #64748b;
      text-align: center;
      padding: 20px;
      background: #0a0f1a;
      border-radius: 10px;
      margin-bottom: 32px;
    }
    #booking .bw-loading {
      color: #64748b;
      text-align: center;
      padding: 20px;
    }
    #booking .bw-form-group { margin-bottom: 16px; }
    #booking .bw-label {
      display: block;
      color: #94a3b8;
      font-size: 0.85rem;
      margin-bottom: 6px;
    }
    #booking .bw-input,
    #booking .bw-select,
    #booking .bw-textarea {
      width: 100%;
      background: #0a0f1a;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 10px;
      color: #e2e8f0;
      padding: 12px 14px;
      font-size: 0.95rem;
      outline: none;
      transition: border-color 0.18s;
      font-family: inherit;
    }
    #booking .bw-input:focus,
    #booking .bw-select:focus,
    #booking .bw-textarea:focus {
      border-color: ${safeColor};
    }
    #booking .bw-select option { background: #0a0f1a; }
    #booking .bw-textarea { resize: vertical; min-height: 90px; }
    #booking .bw-submit-btn {
      width: 100%;
      background: ${safeColor};
      color: #ffffff;
      border: none;
      border-radius: 10px;
      padding: 14px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.18s, transform 0.18s;
      margin-top: 8px;
    }
    #booking .bw-submit-btn:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
    #booking .bw-submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    #booking .bw-success {
      background: #052e16;
      border: 1px solid #10b981;
      border-radius: 12px;
      padding: 28px 24px;
      text-align: center;
    }
    #booking .bw-success-icon { font-size: 2.5rem; margin-bottom: 12px; }
    #booking .bw-success-title { color: #10b981; font-size: 1.3rem; font-weight: 700; margin: 0 0 8px; }
    #booking .bw-success-text { color: #94a3b8; font-size: 0.95rem; margin: 0 0 16px; }
    #booking .bw-success-detail {
      background: #0a2318;
      border-radius: 8px;
      padding: 14px 16px;
      margin-top: 12px;
      text-align: left;
    }
    #booking .bw-success-detail p { margin: 4px 0; color: #e2e8f0; font-size: 0.9rem; }
    #booking .bw-success-detail span { color: #64748b; }
    #booking .bw-error {
      background: #2d0a0a;
      border: 1px solid #ef4444;
      border-radius: 10px;
      padding: 14px 16px;
      color: #f87171;
      font-size: 0.9rem;
      margin-top: 12px;
    }
    #booking .bw-panel {
      background: #0a0f1a;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
    }
    #booking .bw-step-indicator {
      display: flex;
      gap: 6px;
      margin-bottom: 28px;
      justify-content: center;
    }
    #booking .bw-step-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: rgba(255,255,255,0.12);
      transition: background 0.2s;
    }
    #booking .bw-step-dot.active { background: ${safeColor}; }
    #booking .bw-back-btn {
      background: transparent;
      border: 1px solid rgba(255,255,255,0.12);
      color: #94a3b8;
      border-radius: 8px;
      padding: 8px 16px;
      font-size: 0.85rem;
      cursor: pointer;
      margin-bottom: 16px;
      transition: border-color 0.18s, color 0.18s;
    }
    #booking .bw-back-btn:hover { border-color: ${safeColor}; color: ${safeColor}; }
    #booking .bw-selected-summary {
      background: ${safeColor}12;
      border: 1px solid ${safeColor}40;
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 20px;
      color: ${safeColor};
      font-size: 0.88rem;
      font-weight: 500;
    }
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
      step: 1, // 1=date, 2=time, 3=form, 4=done
      selectedDate: null,
      selectedTime: null,
      availableSlots: [],
      loadingSlots: false,
      submitting: false,
      error: null,
      successData: null,
    };

    function pad(n) { return String(n).padStart(2, '0'); }

    function dateStr(d) {
      return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate());
    }

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
      var [y,mo,da] = d.split('-').map(Number);
      var dt = new Date(y, mo-1, da);
      return DAYS[dt.getDay()] + ', ' + da + ' ' + MONTHS[mo-1] + ' ' + y;
    }

    function render() {
      var root = document.getElementById('bw-root');
      if (!root) return;

      if (state.step === 4 && state.successData) {
        root.innerHTML = renderSuccess();
        return;
      }

      var html = '<div class="bw-step-indicator">';
      for (var s = 1; s <= 3; s++) {
        html += '<div class="bw-step-dot' + (state.step >= s ? ' active' : '') + '"></div>';
      }
      html += '</div>';

      if (state.step === 1) {
        html += renderDateStep();
      } else if (state.step === 2) {
        html += renderTimeStep();
      } else if (state.step === 3) {
        html += renderFormStep();
      }

      root.innerHTML = html;
      attachEventListeners();
    }

    function renderDateStep() {
      var dates = generateDates();
      var html = '<span class="bw-section-label">Select a date</span>';
      html += '<div class="bw-date-grid">';
      dates.forEach(function(d) {
        var ds = dateStr(d);
        var isSelected = ds === state.selectedDate;
        var cls = 'bw-date-card' + (isSelected ? ' bw-date-selected' : '');
        html += '<div class="' + cls + '" data-date="' + ds + '">' +
          '<div class="bw-date-dow">' + DAYS[d.getDay()] + '</div>' +
          '<div class="bw-date-num">' + d.getDate() + '</div>' +
          '<div class="bw-date-mon">' + MONTHS[d.getMonth()] + '</div>' +
          '</div>';
      });
      html += '</div>';
      return html;
    }

    function renderTimeStep() {
      var html = '<button class="bw-back-btn" id="bw-back-date">← Back to dates</button>';
      html += '<div class="bw-selected-summary">📅 ' + formatDisplayDate(state.selectedDate) + '</div>';
      html += '<span class="bw-section-label">Select a time</span>';

      if (state.loadingSlots) {
        html += '<div class="bw-loading">Checking availability…</div>';
      } else if (state.availableSlots.length === 0) {
        html += '<div class="bw-no-slots">No availability on this date. Please choose another day.</div>';
      } else {
        html += '<div class="bw-time-grid">';
        state.availableSlots.forEach(function(slot) {
          var isSelected = slot === state.selectedTime;
          html += '<button class="bw-time-btn' + (isSelected ? ' bw-time-selected' : '') + '" data-time="' + slot + '">' + slot + '</button>';
        });
        html += '</div>';
      }
      return html;
    }

    function renderFormStep() {
      var serviceOptions = BW_SERVICES.map(function(s) {
        return '<option value="' + escHtml(s.name) + '">' + escHtml(s.name) + '</option>';
      }).join('');

      var html = '<button class="bw-back-btn" id="bw-back-time">← Back to times</button>';
      html += '<div class="bw-selected-summary">📅 ' + formatDisplayDate(state.selectedDate) + ' &nbsp;·&nbsp; ⏰ ' + state.selectedTime + '</div>';
      html += '<span class="bw-section-label">Your details</span>';
      html += '<div class="bw-panel">';
      html += '<div class="bw-form-group"><label class="bw-label">Full Name *</label><input class="bw-input" id="bw-name" type="text" placeholder="Jane Smith" required /></div>';
      html += '<div class="bw-form-group"><label class="bw-label">Email *</label><input class="bw-input" id="bw-email" type="email" placeholder="jane@example.com" required /></div>';
      html += '<div class="bw-form-group"><label class="bw-label">Phone *</label><input class="bw-input" id="bw-phone" type="tel" placeholder="0400 000 000" required /></div>';
      html += '<div class="bw-form-group"><label class="bw-label">Service *</label><select class="bw-select" id="bw-service">' + serviceOptions + '</select></div>';
      html += '<div class="bw-form-group"><label class="bw-label">Message (optional)</label><textarea class="bw-textarea" id="bw-message" placeholder="Anything you\'d like us to know?"></textarea></div>';
      html += '<button class="bw-submit-btn" id="bw-submit"' + (state.submitting ? ' disabled' : '') + '>' + (state.submitting ? 'Confirming…' : 'Confirm Booking') + '</button>';
      if (state.error) {
        html += '<div class="bw-error">' + escHtml(state.error) + '</div>';
      }
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
        '<p><span>Service: </span>' + escHtml(sd.service) + '</p>' +
        '<p><span>Date: </span>' + escHtml(sd.date) + '</p>' +
        '<p><span>Time: </span>' + escHtml(sd.time) + ' (' + escHtml(sd.timezone) + ')</p>' +
        '</div>' +
        '</div>';
    }

    function escHtml(str) {
      return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function fetchSlots(date) {
      state.loadingSlots = true;
      state.availableSlots = [];
      state.selectedTime = null;
      render();

      fetch(BW_API_BASE + '/api/availability?jobId=' + encodeURIComponent(BW_JOB_ID) + '&date=' + encodeURIComponent(date))
        .then(function(r) { return r.json(); })
        .then(function(data) {
          state.availableSlots = data.available || [];
          state.loadingSlots = false;
          render();
        })
        .catch(function() {
          state.loadingSlots = false;
          state.availableSlots = [];
          render();
        });
    }

    function attachEventListeners() {
      // Date cards
      document.querySelectorAll('#bw-root .bw-date-card:not(.bw-date-disabled)').forEach(function(el) {
        el.addEventListener('click', function() {
          var d = this.getAttribute('data-date');
          state.selectedDate = d;
          state.step = 2;
          fetchSlots(d);
        });
      });

      // Time buttons
      document.querySelectorAll('#bw-root .bw-time-btn').forEach(function(el) {
        el.addEventListener('click', function() {
          state.selectedTime = this.getAttribute('data-time');
          state.step = 3;
          state.error = null;
          render();
        });
      });

      // Back buttons
      var backDate = document.getElementById('bw-back-date');
      if (backDate) {
        backDate.addEventListener('click', function() {
          state.step = 1;
          state.selectedTime = null;
          render();
        });
      }

      var backTime = document.getElementById('bw-back-time');
      if (backTime) {
        backTime.addEventListener('click', function() {
          state.step = 2;
          state.error = null;
          render();
        });
      }

      // Submit
      var submitBtn = document.getElementById('bw-submit');
      if (submitBtn) {
        submitBtn.addEventListener('click', function() {
          var name = (document.getElementById('bw-name') || {}).value || '';
          var email = (document.getElementById('bw-email') || {}).value || '';
          var phone = (document.getElementById('bw-phone') || {}).value || '';
          var service = (document.getElementById('bw-service') || {}).value || '';
          var message = (document.getElementById('bw-message') || {}).value || '';

          if (!name.trim() || !email.trim() || !phone.trim() || !service) {
            state.error = 'Please fill in all required fields.';
            render();
            return;
          }

          if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
            state.error = 'Please enter a valid email address.';
            render();
            return;
          }

          state.submitting = true;
          state.error = null;
          render();

          fetch(BW_API_BASE + '/api/book', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jobId: BW_JOB_ID,
              visitorName: name.trim(),
              visitorEmail: email.trim(),
              visitorPhone: phone.trim(),
              service: service,
              date: state.selectedDate,
              time: state.selectedTime,
              timezone: BW_TIMEZONE,
              message: message.trim(),
            })
          })
          .then(function(r) {
            return r.json().then(function(data) {
              return { ok: r.ok, data: data };
            });
          })
          .then(function(result) {
            state.submitting = false;
            if (result.ok) {
              state.successData = result.data.booking;
              state.step = 4;
              render();
            } else {
              state.error = result.data.error || 'Booking failed. Please try again.';
              render();
            }
          })
          .catch(function() {
            state.submitting = false;
            state.error = 'Network error. Please check your connection and try again.';
            render();
          });
        });
      }
    }

    // Init
    render();
  })();
  </script>
</section>`;
}

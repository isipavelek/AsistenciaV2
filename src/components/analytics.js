import { supabase } from '../lib/supabase.js';
import { showNotification } from '../lib/notifications.js';

export async function renderAnalytics(container) {
  container.innerHTML = `
    <div class="animate-in">
      <h2 style="margin-bottom: 2rem; display: flex; align-items: center; gap: 0.5rem;">
        <i data-lucide="bar-chart-3"></i> Analíticas de Personal
      </h2>

      <div class="dashboard-grid">
        <div class="card glass" style="grid-column: span 2;">
          <h3 class="card-title">Tendencia de Asistencia (Últimos 15 días)</h3>
          <canvas id="attendance-chart" height="100"></canvas>
        </div>

        <div class="card glass">
          <h3 class="card-title">Distribución de Solicitudes</h3>
          <canvas id="auth-dist-chart"></canvas>
        </div>

        <div class="card glass">
          <h3 class="card-title">Cumplimiento por Grupo (%)</h3>
          <canvas id="group-stats-chart"></canvas>
        </div>

        <div class="card glass">
          <h3 class="card-title">Monitor de Bienestar (Últ. 30 días)</h3>
          <canvas id="mood-chart"></canvas>
        </div>
      </div>

      <div class="card glass" style="margin-top: 1rem;">
        <h3 class="card-title"><i data-lucide="message-square"></i> Comentarios Recientes de Bienestar</h3>
        <div id="mood-notes-list" style="max-height: 250px; overflow-y: auto;">
          <p style="color: var(--text-muted); padding: 1rem; text-align: center;">Cargando comentarios...</p>
        </div>
      </div>

      <button id="back-to-dash" style="margin-top: 2rem; background: var(--surface);">Volver al Dashboard</button>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  await initCharts(container);
}

async function initCharts(container) {
  const chartColor = getComputedStyle(document.documentElement).getPropertyValue('--secondary').trim() || '#3b82f6';
  const successColor = '#10b981';
  const dangerColor = '#ef4444';

  try {
    // 1. Attendance Trend (Last 15 days)
    const fifteenDaysAgo = new Date();
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
    
    const { data: attendance } = await supabase
      .from('attendance')
      .select('check_in, status')
      .gte('check_in', fifteenDaysAgo.toISOString())
      .order('check_in');

    const trendData = {};
    attendance.forEach(a => {
      const date = a.check_in.split('T')[0];
      if (!trendData[date]) trendData[date] = { present: 0, total: 0 };
      trendData[date].total++;
      if (a.status === 'present' || a.status === 'late') trendData[date].present++;
    });

    const labels = Object.keys(trendData);
    const values = labels.map(l => (trendData[l].present / trendData[l].total) * 100);

    new Chart(container.querySelector('#attendance-chart'), {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: '% Asistencia',
          data: values,
          borderColor: chartColor,
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: { y: { min: 0, max: 100 } }
      }
    });

    // 2. Auth Distribution
    const { data: auths } = await supabase.from('authorizations').select('type, status');
    const authTypes = {};
    auths.forEach(a => {
      authTypes[a.type] = (authTypes[a.type] || 0) + 1;
    });

    new Chart(container.querySelector('#auth-dist-chart'), {
      type: 'doughnut',
      data: {
        labels: Object.keys(authTypes),
        datasets: [{
          data: Object.values(authTypes),
          backgroundColor: [chartColor, successColor, '#f59e0b', '#8b5cf6', '#ec4899']
        }]
      }
    });

    // 3. Group Stats
    const { data: profiles } = await supabase.from('profiles').select('id, category');
    const groupPresence = { 'Administrativo': { p:0, t:0 }, 'Servicios Generales': { p:0, t:0 } };
    
    const profileMap = new Map(profiles.map(p => [p.id, p.category]));
    
    // Use last 7 days for group comparison
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const { data: recentAtt } = await supabase
      .from('attendance')
      .select('user_id, status')
      .gte('check_in', sevenDaysAgo.toISOString());

    recentAtt.forEach(a => {
      const group = profileMap.get(a.user_id) || 'Otros';
      if (groupPresence[group]) {
        groupPresence[group].t++;
        if (a.status === 'present' || a.status === 'late') groupPresence[group].p++;
      }
    });

    new Chart(container.querySelector('#group-stats-chart'), {
      type: 'bar',
      data: {
        labels: Object.keys(groupPresence),
        datasets: [{
          label: '% Cumplimiento',
          data: Object.keys(groupPresence).map(g => (groupPresence[g].p / groupPresence[g].t || 0) * 100),
          backgroundColor: chartColor
        }]
      },
      options: {
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: { x: { min: 0, max: 100 } }
      }
    });

    // 4. Mood Monitor (Last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: moodData, error: moodError } = await supabase
      .from('attendance')
      .select('mood')
      .not('mood', 'is', null)
      .gte('check_out', thirtyDaysAgo.toISOString());

    if (!moodError) {
      const moodCounts = {
        excellent: 0,
        good: 0,
        neutral: 0,
        tired: 0,
        stressed: 0
      };

      moodData.forEach(m => {
        if (moodCounts.hasOwnProperty(m.mood)) {
          moodCounts[m.mood]++;
        }
      });

      const moodLabels = {
        excellent: '🤩 Excelente',
        good: '😊 Bien',
        neutral: '😐 Normal',
        tired: '😫 Cansado',
        stressed: '🤯 Estresado'
      };

      const moodColors = {
        excellent: '#10b981', // green
        good: '#3b82f6',      // blue
        neutral: '#6b7280',   // gray
        tired: '#f59e0b',     // amber
        stressed: '#ef4444'    // red
      };

      new Chart(container.querySelector('#mood-chart'), {
        type: 'doughnut',
        data: {
          labels: Object.keys(moodCounts).map(k => moodLabels[k]),
          datasets: [{
            data: Object.values(moodCounts),
            backgroundColor: Object.keys(moodCounts).map(k => moodColors[k]),
            borderWidth: 0
          }]
        },
        options: {
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: '#9ca3af', font: { size: 10 } }
            }
          },
          cutout: '60%'
        }
      });
    }

    // 5. Recent Mood Notes
    const { data: recentNotes } = await supabase
      .from('attendance')
      .select(`
        mood,
        mood_note,
        check_out,
        profiles ( full_name )
      `)
      .not('mood_note', 'is', null)
      .order('check_out', { ascending: false })
      .limit(10);

    const notesList = container.querySelector('#mood-notes-list');
    if (recentNotes?.length > 0) {
      const moodEmojis = {
        excellent: '🤩',
        good: '😊',
        neutral: '😐',
        tired: '😫',
        stressed: '🤯'
      };

      notesList.innerHTML = recentNotes.map(n => `
        <div style="padding: 1rem; border-bottom: 1px solid var(--glass-border); display: flex; gap: 1rem; align-items: flex-start;">
          <div style="font-size: 1.5rem;">${moodEmojis[n.mood] || '😶'}</div>
          <div style="flex: 1;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
              <span style="font-weight: bold; font-size: 0.85rem;">${n.profiles?.full_name || 'Personal'}</span>
              <span style="font-size: 0.7rem; color: var(--text-dim);">${new Date(n.check_out).toLocaleDateString()}</span>
            </div>
            <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.4;">${n.mood_note}</p>
          </div>
        </div>
      `).join('');
    } else {
      notesList.innerHTML = '<p style="color: var(--text-muted); padding: 2rem; text-align: center;">No hay comentarios recientes.</p>';
    }

  } catch (err) {
    console.error('Chart init error:', err);
    showNotification('Error al cargar gráficos', 'error');
  }
}

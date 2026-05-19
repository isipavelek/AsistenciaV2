import { supabase } from '../lib/supabase.js';
import { showNotification } from '../lib/notifications.js';

export async function renderAnalytics(container) {
  container.innerHTML = `
    <style>
      .chart-wrapper {
        position: relative;
        height: 240px;
        width: 100%;
        margin-top: 1rem;
      }
    </style>
    <div class="animate-in">
      <h2 style="margin-bottom: 2rem; display: flex; align-items: center; gap: 0.5rem;">
        <i data-lucide="bar-chart-3"></i> Analíticas de Personal
      </h2>

      <div class="dashboard-grid analytics-grid">
        <div class="card glass chart-full-width">
          <h3 class="card-title">Tendencia de Asistencia (Últimos 15 días)</h3>
          <div class="chart-wrapper">
            <canvas id="attendance-chart"></canvas>
          </div>
        </div>

        <div class="card glass">
          <h3 class="card-title">Distribución de Solicitudes</h3>
          <div class="chart-wrapper">
            <canvas id="auth-dist-chart"></canvas>
          </div>
        </div>

        <div class="card glass">
          <h3 class="card-title">Cumplimiento por Grupo (%)</h3>
          <div class="chart-wrapper">
            <canvas id="group-stats-chart"></canvas>
          </div>
        </div>

        <div class="card glass">
          <h3 class="card-title">Monitor de Bienestar (Últ. 30 días)</h3>
          <div class="chart-wrapper">
            <canvas id="mood-chart"></canvas>
          </div>
        </div>
      </div>

      <div class="card glass mood-comments-card">
        <h3 class="card-title"><i data-lucide="message-square"></i> Comentarios Recientes de Bienestar</h3>
        <div id="mood-notes-list" class="scrollable-list">
          <p class="loading-text">Cargando comentarios...</p>
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

  if (!window.Chart) {
    console.error('La librería Chart.js no está disponible.');
    const canvasElements = container.querySelectorAll('canvas');
    canvasElements.forEach(canvas => {
      if (canvas.parentElement) {
        canvas.parentElement.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 2rem; font-size: 0.85rem;">Librería de gráficos no disponible</p>';
      }
    });
  }

  // 1. Attendance Trend (Last 15 days)
  try {
    const fifteenDaysAgo = new Date();
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
    
    const { data: attendance, error: attError } = await supabase
      .from('attendance')
      .select('check_in, check_out, created_at, status')
      .gte('created_at', fifteenDaysAgo.toISOString())
      .order('created_at');

    if (attError) throw attError;

    const trendData = {};
    (attendance || []).forEach(a => {
      const dateVal = a.check_in || a.check_out || a.created_at;
      if (!dateVal) return;
      const date = dateVal.split('T')[0];
      if (!trendData[date]) trendData[date] = { present: 0, total: 0 };
      trendData[date].total++;
      if (a.status === 'present' || a.status === 'late') trendData[date].present++;
    });

    const labels = Object.keys(trendData);
    const values = labels.map(l => trendData[l].total > 0 ? (trendData[l].present / trendData[l].total) * 100 : 0);

    const canvas = container.querySelector('#attendance-chart');
    if (canvas && window.Chart) {
      new window.Chart(canvas, {
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
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { min: 0, max: 100 } }
        }
      });
    }
  } catch (err) {
    console.error('Error loading attendance trend:', err);
    const canvas = container.querySelector('#attendance-chart');
    if (canvas) {
      canvas.parentElement.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 2rem; font-size: 0.85rem;">No se pudieron cargar los datos de tendencia</p>';
    }
  }

  // 2. Auth Distribution
  try {
    const { data: auths, error: authError } = await supabase.from('authorizations').select('type, status');
    if (authError) throw authError;

    const authTypes = {};
    (auths || []).forEach(a => {
      if (a.type) {
        authTypes[a.type] = (authTypes[a.type] || 0) + 1;
      }
    });

    const canvas = container.querySelector('#auth-dist-chart');
    if (canvas && window.Chart && Object.keys(authTypes).length > 0) {
      new window.Chart(canvas, {
        type: 'doughnut',
        data: {
          labels: Object.keys(authTypes),
          datasets: [{
            data: Object.values(authTypes),
            backgroundColor: [chartColor, successColor, '#f59e0b', '#8b5cf6', '#ec4899']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false
        }
      });
    } else if (canvas) {
      canvas.parentElement.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 2rem; font-size: 0.85rem;">Sin solicitudes registradas</p>';
    }
  } catch (err) {
    console.error('Error loading auth distribution:', err);
    const canvas = container.querySelector('#auth-dist-chart');
    if (canvas) {
      canvas.parentElement.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 2rem; font-size: 0.85rem;">No se pudieron cargar los datos de solicitudes</p>';
    }
  }

  // 3. Group Stats
  try {
    const { data: profiles, error: profError } = await supabase.from('profiles').select('id, category');
    if (profError) throw profError;

    const groupPresence = { 'Administrativo': { p:0, t:0 }, 'Servicios Generales': { p:0, t:0 } };
    const profileMap = new Map((profiles || []).map(p => [p.id, p.category]));
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const { data: recentAtt, error: recentAttError } = await supabase
      .from('attendance')
      .select('user_id, status')
      .gte('created_at', sevenDaysAgo.toISOString());

    if (recentAttError) throw recentAttError;

    (recentAtt || []).forEach(a => {
      const group = profileMap.get(a.user_id) || 'Otros';
      if (groupPresence[group]) {
        groupPresence[group].t++;
        if (a.status === 'present' || a.status === 'late') groupPresence[group].p++;
      }
    });

    const canvas = container.querySelector('#group-stats-chart');
    if (canvas && window.Chart) {
      new window.Chart(canvas, {
        type: 'bar',
        data: {
          labels: Object.keys(groupPresence),
          datasets: [{
            label: '% Cumplimiento',
            data: Object.keys(groupPresence).map(g => groupPresence[g].t > 0 ? (groupPresence[g].p / groupPresence[g].t) * 100 : 0),
            backgroundColor: chartColor
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: 'y',
          plugins: { legend: { display: false } },
          scales: { x: { min: 0, max: 100 } }
        }
      });
    }
  } catch (err) {
    console.error('Error loading group stats:', err);
    const canvas = container.querySelector('#group-stats-chart');
    if (canvas) {
      canvas.parentElement.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 2rem; font-size: 0.85rem;">No se pudieron cargar las estadísticas por grupo</p>';
    }
  }

  // 4. Mood Monitor (Last 30 days)
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: moodData, error: moodError } = await supabase
      .from('attendance')
      .select('mood')
      .not('mood', 'is', null)
      .gte('created_at', thirtyDaysAgo.toISOString());

    if (moodError) throw moodError;

    const moodCounts = {
      excellent: 0,
      good: 0,
      neutral: 0,
      tired: 0,
      stressed: 0
    };

    (moodData || []).forEach(m => {
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

    const canvas = container.querySelector('#mood-chart');
    if (canvas && window.Chart && Object.values(moodCounts).some(v => v > 0)) {
      new window.Chart(canvas, {
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
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: '#9ca3af', font: { size: 10 } }
            }
          },
          cutout: '60%'
        }
      });
    } else if (canvas) {
      canvas.parentElement.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 2rem; font-size: 0.85rem;">Sin datos de bienestar en este período</p>';
    }
  } catch (err) {
    console.error('Error loading mood monitor:', err);
    const canvas = container.querySelector('#mood-chart');
    if (canvas) {
      canvas.parentElement.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 2rem; font-size: 0.85rem;">No se pudieron cargar los datos de bienestar</p>';
    }
  }

  // 5. Recent Mood Notes
  try {
    const { data: recentNotes, error: notesError } = await supabase
      .from('attendance')
      .select(`
        mood,
        mood_note,
        check_out,
        created_at,
        profiles!user_id ( full_name )
      `)
      .not('mood_note', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10);

    if (notesError) throw notesError;

    const notesList = container.querySelector('#mood-notes-list');
    if (notesList) {
      if (recentNotes && recentNotes.length > 0) {
        const moodEmojis = {
          excellent: '🤩',
          good: '😊',
          neutral: '😐',
          tired: '😫',
          stressed: '🤯'
        };

        notesList.innerHTML = recentNotes.map(n => {
          const dateVal = n.check_out || n.created_at;
          const dateStr = dateVal ? new Date(dateVal).toLocaleDateString() : '--/--/----';
          return `
            <div style="padding: 1rem; border-bottom: 1px solid var(--glass-border); display: flex; gap: 1rem; align-items: flex-start;">
              <div style="font-size: 1.5rem;">${moodEmojis[n.mood] || '😶'}</div>
              <div style="flex: 1;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                  <span style="font-weight: bold; font-size: 0.85rem;">${n.profiles?.full_name || 'Personal'}</span>
                  <span style="font-size: 0.7rem; color: var(--text-dim);">${dateStr}</span>
                </div>
                <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.4;">${n.mood_note}</p>
              </div>
            </div>
          `;
        }).join('');
      } else {
        notesList.innerHTML = '<p style="color: var(--text-muted); padding: 2rem; text-align: center; font-size: 0.85rem;">No hay comentarios recientes.</p>';
      }
    }
  } catch (err) {
    console.error('Error loading mood comments:', err);
    const notesList = container.querySelector('#mood-notes-list');
    if (notesList) {
      notesList.innerHTML = '<p style="color: var(--text-muted); padding: 2rem; text-align: center; font-size: 0.85rem;">Error al cargar comentarios.</p>';
    }
  }
}

/**
 * strings — the bilingual dictionary (English · Bahasa Indonesia).
 *
 * `en` is the source of truth; its keys define the `StringKey` union, and `id`
 * is typed as `Record<StringKey, string>` so a missing translation is a
 * compile error rather than a silent English fallback.
 *
 * Convention: mathematical notation and SI units (v, H, C_d, ρ, m/s, Pa, x*)
 * are universal and stay identical in both languages — only prose is
 * translated. Interpolate runtime values with `{name}` placeholders; the
 * `translate()` helper substitutes them.
 */

export type Locale = 'en' | 'id'

export const en = {
  /* ---------- toolbar ---------- */
  'app.subtitle': '3D math & physics research',
  'mod.hydro': 'Hydrodynamics',
  'mod.hydroSub': 'Torricelli · efflux',
  'mod.calc': 'Optimisation',
  'mod.calcSub': 'max volume · V′(x)=0',
  'transport.running': 'Running',
  'transport.paused': 'Paused',
  'transport.step': 'Step',
  'transport.reset': 'Reset',
  'tip.pause': 'Pause (Space)',
  'tip.play': 'Play (Space)',
  'tip.step': 'Advance one 1/60 s frame (→)',
  'tip.reset': 'Restart the run (R)',
  'tip.camPreset': 'Camera preset: {label}',
  'tip.language': 'Switch to Indonesian',
  'cam.label': 'cam',
  'preset.iso': 'Iso',
  'preset.crossSection': 'Cross-section',
  'preset.front': 'Front',
  'preset.top': 'Top',
  'preset.orifice': 'Orifice',
  'preset.corner': 'Corner',
  'unit.fps': 'fps',

  /* ---------- sections ---------- */
  'sec.parameters': 'Parameters',
  'sec.shortcuts': 'Shortcuts',
  'sec.liveState': 'Live state',
  'sec.optState': 'Optimisation state',
  'sec.analytics': 'Analytics',
  'sec.equations': 'Equations',
  'sec.diagnostics': 'Renderer diagnostics',

  /* ---------- shortcuts ---------- */
  'sc.playPause': 'play / pause',
  'sc.step': 'single frame step',
  'sc.restart': 'restart run',
  'sc.switchModule': 'switch module',
  'sc.camPresets': 'camera presets',
  'sc.mouse': 'Drag to orbit · scroll to zoom · right-drag to pan',

  /* ---------- viewport HUD ---------- */
  'hud.paused': 'paused',
  'hud.timeScale': '{scale}× time',
  'caption.hydro':
    'Efflux from a sharp-edged orifice. Level integrated with fixed-step RK4; parcels are ballistic with quadratic drag.',
  'caption.calc':
    'Corner squares of side x are removed and the flaps folded to π/2. The green wireframe marks the analytic optimum.',
  'side.left': 'left',
  'side.right': 'right',
  'tip.panelShow': 'Show {side} panel',
  'tip.panelHide': 'Hide {side} panel',

  /* ---------- diagnostics ---------- */
  'stat.frameRate': 'Frame rate',
  'stat.frameTime': 'Frame time',
  'stat.liveParcels': 'Live parcels',
  'stat.drawCalls': 'Draw calls',
  'stat.triangles': 'Triangles',
  'stat.programs': 'Shader programs',
  'meter.parcelBudget': 'parcel budget',

  /* ---------- hydro stats ---------- */
  'stat.simTime': 'Simulated time',
  'stat.waterLevel': 'Water level h',
  'stat.head': 'Head H = h − y',
  'stat.exitVel': 'Efflux speed v',
  'stat.discharge': 'Discharge Q',
  'stat.liquidVol': 'Liquid volume',
  'stat.pOrifice': 'P at orifice',
  'stat.pFloor': 'P at floor',
  'stat.jetRange': 'Jet range R',
  'stat.reynolds': 'Reynolds Re',
  'stat.reynoldsHint': 'Re < 2300 laminar · 2300–4000 transitional · > 4000 turbulent',
  'stat.timeToOrifice': 'Time to orifice',
  'meter.drained': 'drained',
  'meter.capacity': 'capacity',
  'warn.drained':
    'Level has reached the orifice — flow stops here. Lower the hole or enable constant head to keep draining.',

  /* ---------- calculus stats ---------- */
  'stat.cut': 'Cut x',
  'stat.volumeVx': 'Volume V(x)',
  'stat.dVx': 'V′(x)',
  'stat.d2Vx': 'V″(x)',
  'stat.baseArea': 'Base area',
  'stat.sheetArea': 'Sheet area WL − 4x²',
  'stat.optimum': 'Optimum x*',
  'stat.vAtOpt': 'V(x*)',
  'stat.rejectedRoot': 'Rejected root',
  'stat.domainMax': 'Domain max',
  'stat.residual': 'Solver residual',
  'stat.residualHint': 'closed form vs. bisection + Newton',
  'meter.volVsOpt': 'volume vs. optimum',

  /* ---------- charts ---------- */
  'chart.waterLevel': 'Water level h(t) — simulated vs theory',
  'chart.effluxDischarge': 'Efflux speed & discharge',
  'chart.vx': 'V(x) over the feasible domain',
  'chart.dvx': 'V′(x) — the sign change locates x*',
  'chart.empty': 'Press play — the recorder samples every 0.2 s of simulated time.',
  'legend.theory': 'theory',
  'legend.simulated': 'simulated',
  'legend.v': 'v (m/s)',
  'legend.q': 'Q (L/s)',
  'ref.orifice': 'orifice',

  /* ---------- equations: hydro ---------- */
  'eq.torricelli.title': "Torricelli's law",
  'eq.torricelli.note': 'Efflux speed at the vena contracta. Ideal (C_d = 1) would give {v} m/s.',
  'eq.bernoulli.title': 'Bernoulli balance',
  'eq.bernoulli.note':
    'Valid because the free surface descends far more slowly than the jet leaves (A ≫ a).',
  'eq.pressure.title': 'Hydrostatic pressure',
  'eq.pressure.note': 'Gauge pressure at the orifice; at the floor it reaches {p} Pa.',
  'eq.discharge.title': 'Discharge & continuity',
  'eq.discharge.note': 'Mass flow ρQ = {m} kg/s; jet thrust ρQv = {f} N.',
  'eq.ode.title': 'Draining ODE',
  'eq.ode.noteConstant': 'A is constant for this vessel, so the equation is separable.',
  'eq.ode.noteVariable': 'A(h) varies with height for a conical frustum — solved numerically by RK4.',
  'eq.solution.titleClosed': 'Closed-form solution',
  'eq.solution.titleReference': 'Reference solution',
  'eq.solution.note': 'Predicted time to drain to the orifice from the current level: {t}.',
  'eq.range.title': 'Projectile range',
  'eq.range.note':
    'Maximised at y = h/2 = {yh} m, where R_max = C_d·h = {rmax} m. Current hole: y = {y} m.',
  'eq.reynolds.title': 'Orifice Reynolds number',
  'eq.reynolds.note':
    'Flow regime: {regime}. The C_d you pick should reflect this — sharp-edged turbulent orifices sit near 0.62.',
  'regime.laminar': 'laminar',
  'regime.transitional': 'transitional',
  'regime.turbulent': 'turbulent',

  /* ---------- equations: calculus ---------- */
  'eq.volume.title': 'Volume function',
  'eq.volume.note': 'Feasible domain 0 < x < min(W,L)/2 = {d}.',
  'eq.cubic.title': 'Expanded cubic',
  'eq.current.title': 'Current state',
  'eq.current.noteZero': 'V′ = 0 — you are standing exactly on the critical point.',
  'eq.current.notePos': 'V′ > 0: volume still increases with x — cut deeper.',
  'eq.current.noteNeg': 'V′ < 0: volume decreases with x — cut shallower.',
  'eq.stationary.title': 'Stationary condition',
  'eq.stationary.note':
    'Roots: x = {x1} (feasible) and x = {x2} (rejected — at or beyond min(W,L)/2 = {d}, where the base collapses).',
  'eq.secondDeriv.title': 'Second-derivative test',
  'eq.secondDeriv.note': 'The critical point is a {nature}.',
  'nature.maximum': 'maximum',
  'nature.minimum': 'minimum',
  'nature.inflection': 'inflection',
  'eq.optimum.title': 'Optimum',
  'eq.optimum.note': 'Your box holds {pct}% of the maximum.',
  'eq.crosscheck.title': 'Numerical cross-check',
  'eq.crosscheck.note':
    'Closed form vs. bisection on V′ refined by Newton — an honest residual, not a claim.',
  'eq.areas.title': 'Areas',

  /* ---------- control panel: folders ---------- */
  'folder.vessel': 'Vessel',
  'folder.orifice': 'Orifice',
  'folder.environment': 'Environment',
  'folder.particles': 'Particles',
  'folder.display': 'Display',
  'folder.overlays': 'Overlays',
  'folder.scene': 'Scene',
  'folder.sheet': 'Sheet',
  'folder.fold': 'Fold',

  /* ---------- control panel: vessel ---------- */
  'ctl.shape': 'shape',
  'shape.cylinder': 'Cylinder',
  'shape.box': 'Rect. prism',
  'shape.cone': 'Conical frustum',
  'ctl.height': 'height H (m)',
  'ctl.radius': 'radius R (m)',
  'ctl.taper': 'cone taper',
  'ctl.taperHint': 'bottom radius ÷ top radius (conical frustum only)',
  'ctl.width': 'width W (m)',
  'ctl.depth': 'depth D (m)',
  'ctl.fill': 'fill h₀ (m)',

  /* ---------- control panel: orifice ---------- */
  'ctl.holeHeight': 'height y (m)',
  'ctl.holeRadius': 'radius r (m)',
  'ctl.cd': 'C_d',
  'ctl.cdPresets': 'C_d presets',
  'ctl.maxRange': 'max-range hole',

  /* ---------- control panel: environment ---------- */
  'ctl.gravity': 'g (m/s²)',
  'ctl.bodies': 'Bodies',
  'gbtn.earth': 'Earth',
  'gbtn.moon': 'Moon',
  'gbtn.mars': 'Mars',
  'gbtn.zero': '0g',
  'ctl.density': 'ρ (kg/m³)',
  'ctl.viscosity': 'μ (Pa·s)',
  'ctl.fluids': 'Fluids',
  'fluid.water': 'Water',
  'fluid.seawater': 'Seawater',
  'fluid.oil': 'Olive',
  'fluid.glycerin': 'Glycerin',
  'fluid.mercury': 'Mercury',
  'ctl.airDrag': 'air drag k (1/m)',
  'ctl.airDragHint': 'quadratic drag on the jet: a = −k|v|v, terminal speed √(g/k)',
  'ctl.refill': 'constant head',
  'ctl.refillHint': 'refill the tank so the level — and therefore the flow — never drops',

  /* ---------- control panel: particles ---------- */
  'ctl.rate': 'rate (1/s)',
  'ctl.parcelRadius': 'parcel r (m)',
  'ctl.lifetime': 'lifetime (s)',
  'ctl.maxLive': 'max live',
  'ctl.spread': 'divergence',
  'ctl.jitter': 'speed jitter',

  /* ---------- control panel: display ---------- */
  'ctl.pressureField': 'pressure field',
  'ctl.velocityHead': 'velocity + head',
  'ctl.trajectory': 'ideal trajectory',
  'ctl.labels': '3D labels',
  'ctl.crossSection': 'cross-section',
  'ctl.grid': 'grid',
  'ctl.shadows': 'shadows',
  'ctl.autoRotate': 'auto-orbit',
  'ctl.restoreDefaults': 'restore defaults',

  /* ---------- control panel: calculus ---------- */
  'ctl.sheetWidth': 'W',
  'ctl.sheetLength': 'L',
  'ctl.cut': 'cut x',
  'ctl.snapOptimum': 'snap to x*',
  'ctl.squareSheet': 'square sheet',
  'ctl.foldProgress': 'fold θ/(π/2)',
  'ctl.autoFold': 'animate fold',
  'ctl.ghostOptimum': 'ghost optimum',

  /* ---------- control panel: footer ---------- */
  'ctl.footer':
    'Gravity field: {body}. Editing vessel or orifice geometry restarts the run; environment edits keep it going and re-anchor the theoretical curve at the current level.',
  'body.earth': 'earth',
  'body.moon': 'moon',
  'body.mars': 'mars',
  'body.jupiter': 'jupiter',
  'body.zero': 'zero-g',
  'body.custom': 'custom',
} as const

export type StringKey = keyof typeof en

export const id: Record<StringKey, string> = {
  /* ---------- toolbar ---------- */
  'app.subtitle': 'riset matematika & fisika 3D',
  'mod.hydro': 'Hidrodinamika',
  'mod.hydroSub': 'Torricelli · pancaran',
  'mod.calc': 'Optimisasi',
  'mod.calcSub': 'volume maks · V′(x)=0',
  'transport.running': 'Berjalan',
  'transport.paused': 'Terjeda',
  'transport.step': 'Langkah',
  'transport.reset': 'Atur ulang',
  'tip.pause': 'Jeda (Spasi)',
  'tip.play': 'Putar (Spasi)',
  'tip.step': 'Maju satu bingkai 1/60 s (→)',
  'tip.reset': 'Mulai ulang simulasi (R)',
  'tip.camPreset': 'Praatur kamera: {label}',
  'tip.language': 'Ganti ke bahasa Inggris',
  'cam.label': 'kam',
  'preset.iso': 'Iso',
  'preset.crossSection': 'Penampang',
  'preset.front': 'Depan',
  'preset.top': 'Atas',
  'preset.orifice': 'Lubang',
  'preset.corner': 'Sudut',
  'unit.fps': 'fps',

  /* ---------- sections ---------- */
  'sec.parameters': 'Parameter',
  'sec.shortcuts': 'Pintasan',
  'sec.liveState': 'Keadaan langsung',
  'sec.optState': 'Keadaan optimisasi',
  'sec.analytics': 'Analitik',
  'sec.equations': 'Persamaan',
  'sec.diagnostics': 'Diagnostik perender',

  /* ---------- shortcuts ---------- */
  'sc.playPause': 'putar / jeda',
  'sc.step': 'maju satu bingkai',
  'sc.restart': 'mulai ulang',
  'sc.switchModule': 'ganti modul',
  'sc.camPresets': 'praatur kamera',
  'sc.mouse': 'Seret untuk berputar · gulir untuk zoom · seret-kanan untuk menggeser',

  /* ---------- viewport HUD ---------- */
  'hud.paused': 'terjeda',
  'hud.timeScale': 'waktu {scale}×',
  'caption.hydro':
    'Pancaran dari lubang bertepi tajam. Ketinggian diintegrasikan dengan RK4 langkah-tetap; partikel bersifat balistik dengan hambatan kuadratik.',
  'caption.calc':
    'Persegi sudut bersisi x dibuang dan sirip dilipat hingga π/2. Kerangka hijau menandai optimum analitik.',
  'side.left': 'kiri',
  'side.right': 'kanan',
  'tip.panelShow': 'Tampilkan panel {side}',
  'tip.panelHide': 'Sembunyikan panel {side}',

  /* ---------- diagnostics ---------- */
  'stat.frameRate': 'Laju bingkai',
  'stat.frameTime': 'Waktu bingkai',
  'stat.liveParcels': 'Partikel aktif',
  'stat.drawCalls': 'Panggilan gambar',
  'stat.triangles': 'Segitiga',
  'stat.programs': 'Program shader',
  'meter.parcelBudget': 'anggaran partikel',

  /* ---------- hydro stats ---------- */
  'stat.simTime': 'Waktu simulasi',
  'stat.waterLevel': 'Ketinggian air h',
  'stat.head': 'Head H = h − y',
  'stat.exitVel': 'Kecepatan pancaran v',
  'stat.discharge': 'Debit Q',
  'stat.liquidVol': 'Volume cairan',
  'stat.pOrifice': 'P di lubang',
  'stat.pFloor': 'P di dasar',
  'stat.jetRange': 'Jangkauan pancaran R',
  'stat.reynolds': 'Reynolds Re',
  'stat.reynoldsHint': 'Re < 2300 laminar · 2300–4000 transisi · > 4000 turbulen',
  'stat.timeToOrifice': 'Waktu ke lubang',
  'meter.drained': 'terkuras',
  'meter.capacity': 'kapasitas',
  'warn.drained':
    'Ketinggian telah mencapai lubang — aliran berhenti di sini. Turunkan lubang atau aktifkan head konstan agar terus mengalir.',

  /* ---------- calculus stats ---------- */
  'stat.cut': 'Potongan x',
  'stat.volumeVx': 'Volume V(x)',
  'stat.dVx': 'V′(x)',
  'stat.d2Vx': 'V″(x)',
  'stat.baseArea': 'Luas alas',
  'stat.sheetArea': 'Luas lembar WL − 4x²',
  'stat.optimum': 'Optimum x*',
  'stat.vAtOpt': 'V(x*)',
  'stat.rejectedRoot': 'Akar ditolak',
  'stat.domainMax': 'Domain maks',
  'stat.residual': 'Residu penyelesai',
  'stat.residualHint': 'bentuk tertutup vs. biseksi + Newton',
  'meter.volVsOpt': 'volume vs. optimum',

  /* ---------- charts ---------- */
  'chart.waterLevel': 'Ketinggian air h(t) — simulasi vs teori',
  'chart.effluxDischarge': 'Kecepatan pancaran & debit',
  'chart.vx': 'V(x) pada domain layak',
  'chart.dvx': 'V′(x) — perubahan tanda menandai x*',
  'chart.empty': 'Tekan putar — perekam mengambil sampel tiap 0,2 s waktu simulasi.',
  'legend.theory': 'teori',
  'legend.simulated': 'simulasi',
  'legend.v': 'v (m/s)',
  'legend.q': 'Q (L/s)',
  'ref.orifice': 'lubang',

  /* ---------- equations: hydro ---------- */
  'eq.torricelli.title': 'Hukum Torricelli',
  'eq.torricelli.note':
    'Kecepatan pancaran di vena contracta. Ideal (C_d = 1) menghasilkan {v} m/s.',
  'eq.bernoulli.title': 'Kesetimbangan Bernoulli',
  'eq.bernoulli.note':
    'Berlaku karena permukaan bebas turun jauh lebih lambat daripada pancaran keluar (A ≫ a).',
  'eq.pressure.title': 'Tekanan hidrostatis',
  'eq.pressure.note': 'Tekanan tolok di lubang; di dasar mencapai {p} Pa.',
  'eq.discharge.title': 'Debit & kontinuitas',
  'eq.discharge.note': 'Laju aliran massa ρQ = {m} kg/s; gaya dorong pancaran ρQv = {f} N.',
  'eq.ode.title': 'PDB pengurasan',
  'eq.ode.noteConstant': 'A konstan untuk bejana ini, sehingga persamaan dapat dipisahkan.',
  'eq.ode.noteVariable':
    'A(h) berubah terhadap ketinggian untuk kerucut terpancung — diselesaikan numerik dengan RK4.',
  'eq.solution.titleClosed': 'Solusi bentuk tertutup',
  'eq.solution.titleReference': 'Solusi rujukan',
  'eq.solution.note': 'Perkiraan waktu terkuras hingga lubang dari ketinggian saat ini: {t}.',
  'eq.range.title': 'Jangkauan proyektil',
  'eq.range.note':
    'Maksimum pada y = h/2 = {yh} m, di mana R_maks = C_d·h = {rmax} m. Lubang saat ini: y = {y} m.',
  'eq.reynolds.title': 'Bilangan Reynolds lubang',
  'eq.reynolds.note':
    'Rezim aliran: {regime}. C_d yang dipilih harus mencerminkan ini — lubang bertepi tajam turbulen berada di sekitar 0,62.',
  'regime.laminar': 'laminar',
  'regime.transitional': 'transisi',
  'regime.turbulent': 'turbulen',

  /* ---------- equations: calculus ---------- */
  'eq.volume.title': 'Fungsi volume',
  'eq.volume.note': 'Domain layak 0 < x < min(W,L)/2 = {d}.',
  'eq.cubic.title': 'Kubik terurai',
  'eq.current.title': 'Keadaan saat ini',
  'eq.current.noteZero': 'V′ = 0 — Anda tepat berada pada titik kritis.',
  'eq.current.notePos': 'V′ > 0: volume masih naik terhadap x — potong lebih dalam.',
  'eq.current.noteNeg': 'V′ < 0: volume turun terhadap x — potong lebih dangkal.',
  'eq.stationary.title': 'Kondisi stasioner',
  'eq.stationary.note':
    'Akar: x = {x1} (layak) dan x = {x2} (ditolak — pada atau melebihi min(W,L)/2 = {d}, di mana alas menyusut nol).',
  'eq.secondDeriv.title': 'Uji turunan kedua',
  'eq.secondDeriv.note': 'Titik kritis ini adalah {nature}.',
  'nature.maximum': 'maksimum',
  'nature.minimum': 'minimum',
  'nature.inflection': 'titik belok',
  'eq.optimum.title': 'Optimum',
  'eq.optimum.note': 'Kotak Anda menampung {pct}% dari maksimum.',
  'eq.crosscheck.title': 'Pemeriksaan silang numerik',
  'eq.crosscheck.note':
    'Bentuk tertutup vs. biseksi pada V′ yang disempurnakan Newton — residu jujur, bukan klaim.',
  'eq.areas.title': 'Luas',

  /* ---------- control panel: folders ---------- */
  'folder.vessel': 'Bejana',
  'folder.orifice': 'Lubang',
  'folder.environment': 'Lingkungan',
  'folder.particles': 'Partikel',
  'folder.display': 'Tampilan',
  'folder.overlays': 'Hamparan',
  'folder.scene': 'Adegan',
  'folder.sheet': 'Lembar',
  'folder.fold': 'Lipatan',

  /* ---------- control panel: vessel ---------- */
  'ctl.shape': 'bentuk',
  'shape.cylinder': 'Silinder',
  'shape.box': 'Prisma persegi',
  'shape.cone': 'Kerucut terpancung',
  'ctl.height': 'tinggi H (m)',
  'ctl.radius': 'jari-jari R (m)',
  'ctl.taper': 'lancip kerucut',
  'ctl.taperHint': 'jari-jari bawah ÷ atas (hanya kerucut terpancung)',
  'ctl.width': 'lebar W (m)',
  'ctl.depth': 'kedalaman D (m)',
  'ctl.fill': 'isian h₀ (m)',

  /* ---------- control panel: orifice ---------- */
  'ctl.holeHeight': 'tinggi y (m)',
  'ctl.holeRadius': 'jari-jari r (m)',
  'ctl.cd': 'C_d',
  'ctl.cdPresets': 'praatur C_d',
  'ctl.maxRange': 'lubang jangkauan-maks',

  /* ---------- control panel: environment ---------- */
  'ctl.gravity': 'g (m/s²)',
  'ctl.bodies': 'Benda',
  'gbtn.earth': 'Bumi',
  'gbtn.moon': 'Bulan',
  'gbtn.mars': 'Mars',
  'gbtn.zero': '0g',
  'ctl.density': 'ρ (kg/m³)',
  'ctl.viscosity': 'μ (Pa·s)',
  'ctl.fluids': 'Fluida',
  'fluid.water': 'Air',
  'fluid.seawater': 'Laut',
  'fluid.oil': 'Zaitun',
  'fluid.glycerin': 'Gliserin',
  'fluid.mercury': 'Raksa',
  'ctl.airDrag': 'hambatan udara k (1/m)',
  'ctl.airDragHint': 'hambatan kuadratik pada pancaran: a = −k|v|v, kecepatan terminal √(g/k)',
  'ctl.refill': 'head konstan',
  'ctl.refillHint': 'isi ulang tangki agar ketinggian — dan aliran — tidak pernah turun',

  /* ---------- control panel: particles ---------- */
  'ctl.rate': 'laju (1/s)',
  'ctl.parcelRadius': 'jari-jari partikel (m)',
  'ctl.lifetime': 'masa hidup (s)',
  'ctl.maxLive': 'maks aktif',
  'ctl.spread': 'divergensi',
  'ctl.jitter': 'jitter kecepatan',

  /* ---------- control panel: display ---------- */
  'ctl.pressureField': 'medan tekanan',
  'ctl.velocityHead': 'kecepatan + head',
  'ctl.trajectory': 'lintasan ideal',
  'ctl.labels': 'label 3D',
  'ctl.crossSection': 'penampang',
  'ctl.grid': 'kisi',
  'ctl.shadows': 'bayangan',
  'ctl.autoRotate': 'orbit-otomatis',
  'ctl.restoreDefaults': 'pulihkan bawaan',

  /* ---------- control panel: calculus ---------- */
  'ctl.sheetWidth': 'W',
  'ctl.sheetLength': 'L',
  'ctl.cut': 'potongan x',
  'ctl.snapOptimum': 'jepret ke x*',
  'ctl.squareSheet': 'lembar persegi',
  'ctl.foldProgress': 'lipat θ/(π/2)',
  'ctl.autoFold': 'animasikan lipatan',
  'ctl.ghostOptimum': 'bayang optimum',

  /* ---------- control panel: footer ---------- */
  'ctl.footer':
    'Medan gravitasi: {body}. Mengubah geometri bejana atau lubang memulai ulang simulasi; perubahan lingkungan tetap berjalan dan menambatkan ulang kurva teori pada ketinggian saat ini.',
  'body.earth': 'bumi',
  'body.moon': 'bulan',
  'body.mars': 'mars',
  'body.jupiter': 'jupiter',
  'body.zero': 'nol-g',
  'body.custom': 'kustom',
}

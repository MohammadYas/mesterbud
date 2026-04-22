$utf8 = [System.Text.UTF8Encoding]::new($false)
$base = "C:\Users\mo\Desktop\mesterbud\brancher"

function gen($d) {
  $mockupRows = ''
  foreach ($l in $d.linjer) {
    $mockupRows += "<tr><td class=`"py-3 text-on-surface`">$($l[0])</td><td class=`"text-right py-3 font-medium text-on-surface`">$($l[1])</td></tr>"
  }
  $featCards = ''
  foreach ($f in $d.feat) {
    $featCards += "<div class=`"p-8 bg-surface-container-low rounded-2xl`"><span class=`"material-symbols-outlined text-primary text-3xl mb-5 block`">$($f[0])</span><h3 class=`"font-bold text-lg mb-2 text-on-surface`">$($f[1])</h3><p class=`"text-on-surface-variant text-sm leading-relaxed`">$($f[2])</p></div>"
  }
  $faqItems = ''
  $fi = 0
  foreach ($faq in $d.faqs) {
    $faqItems += "<div class=`"bg-surface-container-low rounded-xl border border-outline-variant/20 overflow-hidden`"><button @click=`"open = open === $fi ? null : $fi`" class=`"w-full text-left px-6 py-5 flex items-center justify-between font-bold`"><span>$($faq[0])</span><span class=`"material-symbols-outlined transition-transform`" :class=`"open === $fi ? 'rotate-180' : ''`">expand_more</span></button><div x-show=`"open === $fi`" x-cloak class=`"px-6 pb-5 text-on-surface-variant text-sm leading-relaxed`">$($faq[1])</div></div>"
    $fi++
  }
  $faqJson = ($d.faqs | ForEach-Object { "{`"@type`":`"Question`",`"name`":`"$($_[0])`",`"acceptedAnswer`":{`"@type`":`"Answer`",`"text`":`"$($_[1])`"}}" }) -join ','

  $html = @"
<!DOCTYPE html>
<html lang="da" class="light">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>$($d.titel)</title>
<meta name="description" content="$($d.desc)"/>
<meta name="keywords" content="$($d.kw)"/>
<meta name="robots" content="index, follow"/>
<link rel="canonical" href="https://mesterbud.dk/brancher/$($d.slug)"/>
<meta property="og:title" content="$($d.titel)"/>
<meta property="og:description" content="$($d.desc)"/>
<meta property="og:url" content="https://mesterbud.dk/brancher/$($d.slug)"/>
<meta property="og:type" content="website"/>
<meta property="og:locale" content="da_DK"/>
<meta name="theme-color" content="#a23900"/>
<link rel="icon" type="image/svg+xml" href="/assets/favicon.svg"/>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"SoftwareApplication","name":"Mesterbud","applicationCategory":"BusinessApplication","operatingSystem":"Web","description":"$($d.desc)","url":"https://mesterbud.dk/brancher/$($d.slug)","offers":[{"@type":"Offer","name":"Basis","price":"149","priceCurrency":"DKK","billingDuration":"P1M"},{"@type":"Offer","name":"Pro","price":"299","priceCurrency":"DKK","billingDuration":"P1M"}],"inLanguage":"da"}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Mesterbud","item":"https://mesterbud.dk/"},{"@type":"ListItem","position":2,"name":"Brancher","item":"https://mesterbud.dk/brancher/"},{"@type":"ListItem","position":3,"name":"$($d.nav)","item":"https://mesterbud.dk/brancher/$($d.slug)"}]}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[$faqJson]}</script>
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,200..800;1,6..72,200..800&family=Plus+Jakarta+Sans:wght@200..800&display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap" rel="stylesheet"/>
<script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<script>tailwind.config={darkMode:"class",theme:{extend:{colors:{"primary":"#a23900","primary-container":"#cb4a01","on-primary":"#ffffff","primary-fixed":"#ffdbce","surface":"#fdf9f3","surface-container":"#f1ede7","surface-container-low":"#f7f3ed","surface-container-lowest":"#ffffff","surface-container-high":"#ebe8e2","on-surface":"#1c1c18","on-surface-variant":"#594138","outline":"#8d7167","outline-variant":"#e1bfb3","background":"#fdf9f3"},borderRadius:{"DEFAULT":"0.125rem","lg":"0.25rem","xl":"0.5rem","full":"0.75rem"},fontFamily:{"headline":["Newsreader","serif"],"body":["Plus Jakarta Sans","sans-serif"]}}}}</script>
<style>.material-symbols-outlined{font-family:'Material Symbols Outlined';font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;vertical-align:middle;}body{font-family:'Plus Jakarta Sans',sans-serif;}h1,h2,h3,.font-serif{font-family:'Newsreader',serif;}[x-cloak]{display:none!important;}</style>
</head>
<body class="bg-surface text-on-surface selection:bg-primary-fixed">

<!-- NAV -->
<nav class="fixed top-0 w-full z-50 bg-white/95 backdrop-blur-md border-b border-outline-variant/30 h-16 flex items-center" x-data="{ mo: false }">
  <div class="w-full max-w-7xl mx-auto px-6 flex items-center justify-between">
    <a href="/" class="flex items-center gap-2 font-serif font-bold text-xl text-on-surface hover:opacity-80 transition-opacity">
      <span class="material-symbols-outlined text-primary">handyman</span>Mesterbud
    </a>
    <div class="hidden md:flex items-center gap-8">
      <a href="/brancher/" class="text-on-surface-variant hover:text-on-surface transition-colors font-medium text-sm">Alle brancher</a>
      <a href="/#funktioner" class="text-on-surface-variant hover:text-on-surface transition-colors font-medium text-sm">Funktioner</a>
      <a href="/#priser" class="text-on-surface-variant hover:text-on-surface transition-colors font-medium text-sm">Priser</a>
      <a href="/login.html" class="text-on-surface-variant hover:text-on-surface transition-colors font-medium text-sm">Log ind</a>
    </div>
    <div class="hidden md:flex">
      <a href="/signup.html" class="bg-primary text-white px-5 py-2 rounded-lg font-bold text-sm hover:opacity-90 active:scale-95 transition-all">Opret gratis konto</a>
    </div>
    <div class="flex md:hidden items-center gap-3">
      <a href="/login.html" class="text-on-surface-variant font-medium text-sm">Log ind</a>
      <button @click="mo = !mo" class="text-on-surface p-1" aria-label="Menu">
        <span class="material-symbols-outlined" x-text="mo ? 'close' : 'menu'">menu</span>
      </button>
    </div>
  </div>
  <div x-show="mo" x-cloak class="md:hidden absolute top-16 left-0 w-full bg-white border-b border-outline-variant/30 shadow-lg px-6 py-4 flex flex-col gap-3">
    <a href="/brancher/" @click="mo=false" class="text-on-surface font-medium py-2 border-b border-outline-variant/20">Alle brancher</a>
    <a href="/#funktioner" @click="mo=false" class="text-on-surface font-medium py-2 border-b border-outline-variant/20">Funktioner</a>
    <a href="/#priser" @click="mo=false" class="text-on-surface font-medium py-2 border-b border-outline-variant/20">Priser</a>
    <a href="/signup.html" class="bg-primary text-white px-5 py-3 rounded-lg font-bold text-center mt-2">Opret gratis konto</a>
  </div>
</nav>

<main class="pt-16">
  <!-- BREADCRUMB -->
  <div class="bg-surface-container-low border-b border-outline-variant/20 py-3">
    <div class="max-w-7xl mx-auto px-6 flex items-center gap-2 text-sm text-on-surface-variant">
      <a href="/" class="hover:text-primary transition-colors">Mesterbud</a>
      <span class="material-symbols-outlined text-sm">chevron_right</span>
      <a href="/brancher/" class="hover:text-primary transition-colors">Brancher</a>
      <span class="material-symbols-outlined text-sm">chevron_right</span>
      <span class="text-on-surface font-medium">$($d.nav)</span>
    </div>
  </div>

  <!-- HERO -->
  <section class="pt-16 pb-20 md:pt-24 md:pb-28 bg-white">
    <div class="max-w-7xl mx-auto px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-[55%_45%] gap-16 items-center">
      <div>
        <div class="flex items-center gap-3 mb-5">
          <span class="material-symbols-outlined text-primary text-3xl">$($d.icon)</span>
          <p class="text-primary font-bold text-xs uppercase tracking-widest">$($d.tagline)</p>
        </div>
        <h1 class="font-serif font-bold text-4xl md:text-5xl lg:text-6xl leading-tight text-on-surface mb-6">$($d.h1)</h1>
        <p class="text-lg text-on-surface-variant leading-relaxed max-w-lg mb-8">$($d.hero)</p>
        <div class="flex flex-wrap items-center gap-5 mb-8">
          <a href="/signup.html" class="bg-primary text-white px-8 py-3.5 rounded-lg font-bold text-base hover:opacity-90 active:scale-95 transition-all inline-block">Prøv gratis i 14 dage</a>
          <a href="/#hvordan" class="text-on-surface-variant font-medium underline underline-offset-4 hover:text-primary transition-colors text-sm">Se hvordan det virker</a>
        </div>
        <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-on-surface-variant">
          <span class="flex items-center gap-1.5"><span class="material-symbols-outlined text-primary text-base">check_circle</span> Ingen binding</span>
          <span class="flex items-center gap-1.5"><span class="material-symbols-outlined text-primary text-base">check_circle</span> Dansk produkt</span>
          <span class="flex items-center gap-1.5"><span class="material-symbols-outlined text-primary text-base">check_circle</span> Gratis at starte</span>
        </div>
      </div>
      <!-- TILBUD MOCKUP -->
      <div class="hidden md:block">
        <div class="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-xl overflow-hidden">
          <div class="bg-gradient-to-r from-primary to-primary-container px-6 py-5 text-white">
            <div class="flex justify-between items-start">
              <div><p class="text-white/70 text-xs font-medium mb-1">TILBUD NR.</p><p class="text-2xl font-bold">MB-2026-047</p></div>
              <div class="text-right"><p class="text-white/70 text-xs font-medium mb-1">DATO</p><p class="font-bold text-sm">22. april 2026</p></div>
            </div>
            <p class="text-white/80 text-sm mt-3 font-medium">$($d.mockupTitel)</p>
          </div>
          <div class="p-6">
            <table class="w-full text-sm mb-5">
              <thead><tr class="border-b-2 border-outline-variant"><th class="text-left py-2 font-bold text-on-surface-variant text-xs">Beskrivelse</th><th class="text-right py-2 font-bold text-on-surface-variant text-xs">Pris</th></tr></thead>
              <tbody class="divide-y divide-outline-variant/30">$mockupRows</tbody>
            </table>
            <div class="flex justify-between items-center pt-3 border-t-2 border-primary/20">
              <span class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Total inkl. moms</span>
              <span class="font-serif font-bold text-xl text-primary">$($d.total)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- TRUST BAR -->
  <section class="py-8 border-y border-outline-variant/20 bg-surface-container-low">
    <div class="max-w-7xl mx-auto px-6 flex flex-wrap items-center justify-center gap-8 text-sm text-on-surface-variant font-medium">
      <span class="flex items-center gap-2"><span class="material-symbols-outlined text-primary text-base">check_circle</span> 523 håndværkere bruger Mesterbud</span>
      <span class="flex items-center gap-2"><span class="material-symbols-outlined text-primary text-base">assignment_turned_in</span> 15.847 tilbud sendt</span>
      <span class="flex items-center gap-2"><span class="material-symbols-outlined text-primary text-base">verified_user</span> GDPR-kompatibel – Dansk produkt</span>
      <span class="flex items-center gap-2"><span class="material-symbols-outlined text-primary text-base">support_agent</span> Dansk support på hverdage</span>
    </div>
  </section>

  <!-- FEATURES -->
  <section class="py-24 bg-white">
    <div class="max-w-7xl mx-auto px-6 lg:px-8">
      <h2 class="font-serif font-bold text-3xl md:text-4xl text-center mb-4 text-on-surface">Bygget til $($d.nav.ToLower())e</h2>
      <p class="text-center text-on-surface-variant mb-16 max-w-xl mx-auto">$($d.fordele)</p>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8">$featCards</div>
    </div>
  </section>

  <!-- SÅDAN VIRKER DET -->
  <section class="py-24 bg-surface-container-low">
    <div class="max-w-5xl mx-auto px-6 lg:px-8">
      <h2 class="font-serif font-bold text-3xl md:text-4xl text-center mb-16 text-on-surface">Sådan virker Mesterbud</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-10">
        <div class="text-center">
          <div class="w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center text-2xl font-bold mx-auto mb-5">1</div>
          <h3 class="font-bold text-lg mb-2">Opret dit tilbud</h3>
          <p class="text-on-surface-variant text-sm leading-relaxed">Vælg $($d.nav.ToLower())-skabelon eller brug AI-stemmediktering. Realistiske priser udfyldes automatisk.</p>
        </div>
        <div class="text-center">
          <div class="w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center text-2xl font-bold mx-auto mb-5">2</div>
          <h3 class="font-bold text-lg mb-2">Tilpas og send</h3>
          <p class="text-on-surface-variant text-sm leading-relaxed">Justér linjer, priser og noter. Send tilbuddet direkte til kunden via e-mail – ét klik.</p>
        </div>
        <div class="text-center">
          <div class="w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center text-2xl font-bold mx-auto mb-5">3</div>
          <h3 class="font-bold text-lg mb-2">Modtag digital accept</h3>
          <p class="text-on-surface-variant text-sm leading-relaxed">Kunden accepterer med ét klik. Du får besked med det samme – ingen papirer, ingen ventetid.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- PRISER -->
  <section class="py-24 bg-white">
    <div class="max-w-7xl mx-auto px-6 lg:px-8">
      <h2 class="font-serif font-bold text-3xl md:text-4xl text-center mb-3 text-on-surface">Priser der giver mening</h2>
      <p class="text-center text-on-surface-variant mb-12">Start gratis. Betal kun hvis du vil have mere.</p>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        <!-- Gratis -->
        <div class="bg-white border border-outline-variant/30 rounded-xl p-8 flex flex-col">
          <h3 class="font-serif font-bold text-2xl text-on-surface mb-1">Gratis</h3>
          <p class="text-on-surface-variant text-sm mb-6">Kom i gang uden risiko</p>
          <div class="mb-8"><span class="font-serif font-bold text-5xl text-on-surface">0 kr.</span></div>
          <ul class="space-y-3 mb-8 flex-1">
            <li class="flex items-center gap-3 text-sm text-on-surface"><span class="material-symbols-outlined text-primary text-base">done</span>1 tilbud gratis</li>
            <li class="flex items-center gap-3 text-sm text-on-surface"><span class="material-symbols-outlined text-primary text-base">done</span>Se hvordan det virker</li>
            <li class="flex items-center gap-3 text-sm text-on-surface"><span class="material-symbols-outlined text-primary text-base">done</span>Ingen kreditkort nødvendigt</li>
          </ul>
          <a href="/signup.html" class="border border-primary text-primary py-3 rounded-lg font-bold text-center block hover:bg-primary/5 transition-colors">Prøv gratis</a>
        </div>
        <!-- Basis -->
        <div class="bg-white border border-outline-variant/30 rounded-xl p-8 flex flex-col">
          <h3 class="font-serif font-bold text-2xl text-on-surface mb-1">Basis</h3>
          <p class="text-on-surface-variant text-sm mb-6">Til den selvstændige $($d.nav.ToLower())</p>
          <div class="mb-8"><span class="font-serif font-bold text-5xl text-on-surface">149</span><span class="text-on-surface-variant font-bold ml-1">kr/md</span></div>
          <ul class="space-y-3 mb-8 flex-1">
            <li class="flex items-center gap-3 text-sm text-on-surface"><span class="material-symbols-outlined text-primary text-base">done</span>Ubegrænsede tilbud</li>
            <li class="flex items-center gap-3 text-sm text-on-surface"><span class="material-symbols-outlined text-primary text-base">done</span>$($d.nav)-skabeloner</li>
            <li class="flex items-center gap-3 text-sm text-on-surface"><span class="material-symbols-outlined text-primary text-base">done</span>Digital accept fra kunden</li>
            <li class="flex items-center gap-3 text-sm text-on-surface"><span class="material-symbols-outlined text-primary text-base">done</span>PDF-download</li>
            <li class="flex items-center gap-3 text-sm text-on-surface"><span class="material-symbols-outlined text-primary text-base">done</span>Tilbud fra mobilen</li>
          </ul>
          <a href="/signup.html" class="border border-primary text-primary py-3 rounded-lg font-bold text-center block hover:bg-primary/5 transition-colors">Vælg Basis</a>
          <p class="text-xs text-on-surface-variant text-center mt-3">14 dages prøveperiode når du abonnerer</p>
        </div>
        <!-- Pro -->
        <div class="bg-primary rounded-xl p-8 flex flex-col">
          <h3 class="font-serif font-bold text-2xl text-white mb-1">Pro</h3>
          <p class="text-white/70 text-sm mb-6">Til dig der vil vinde flere opgaver</p>
          <div class="mb-8"><span class="font-serif font-bold text-5xl text-white">299</span><span class="text-white/70 font-bold ml-1">kr/md</span></div>
          <ul class="space-y-3 mb-8 flex-1">
            <li class="flex items-center gap-3 text-sm text-white"><span class="material-symbols-outlined text-white/80 text-base">done</span>Alt i Basis</li>
            <li class="flex items-center gap-3 text-sm text-white"><span class="material-symbols-outlined text-white/80 text-base">done</span>AI-stemmediktering af tilbud</li>
            <li class="flex items-center gap-3 text-sm text-white"><span class="material-symbols-outlined text-white/80 text-base">done</span>AI-fotoanalyse af opgave</li>
            <li class="flex items-center gap-3 text-sm text-white"><span class="material-symbols-outlined text-white/80 text-base">done</span>AI-opfølgningsmail</li>
            <li class="flex items-center gap-3 text-sm text-white"><span class="material-symbols-outlined text-white/80 text-base">done</span>Prioriteret support</li>
          </ul>
          <a href="/signup.html" class="bg-white text-primary py-3 rounded-lg font-bold text-center block hover:opacity-90 transition-opacity">Vælg Pro</a>
          <p class="text-xs text-white/60 text-center mt-3">14 dages prøveperiode når du abonnerer</p>
        </div>
      </div>
    </div>
  </section>

  <!-- FAQ -->
  <section class="py-24 bg-surface-container-low">
    <div class="max-w-3xl mx-auto px-6">
      <h2 class="font-serif font-bold text-3xl md:text-4xl text-center text-on-surface mb-16">Ofte stillede spørgsmål</h2>
      <div class="space-y-4" x-data="{ open: null }">$faqItems</div>
    </div>
  </section>

  <!-- CTA -->
  <section class="py-24 bg-white">
    <div class="max-w-2xl mx-auto px-6 text-center">
      <h2 class="font-serif font-bold text-3xl md:text-4xl text-on-surface mb-5">$($d.ctaH2)</h2>
      <p class="text-on-surface-variant text-lg mb-8">$($d.ctaTxt)</p>
      <a href="/signup.html" class="bg-primary text-white px-10 py-4 rounded-lg font-bold text-lg inline-block hover:opacity-90 active:scale-95 transition-all">Prøv gratis i 14 dage</a>
      <p class="text-sm text-on-surface-variant mt-6">Ingen binding · Opsig når som helst · Gratis at starte</p>
    </div>
  </section>
</main>

<!-- FOOTER -->
<footer class="bg-stone-100 pt-16 pb-8">
  <div class="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-10 items-start mb-12">
    <div>
      <p class="font-serif font-bold text-xl text-stone-900 mb-2">Mesterbud</p>
      <p class="text-stone-500 text-sm mb-6">Professionelle tilbud til danske håndværkere</p>
      <div class="flex flex-wrap gap-x-6 gap-y-3">
        <a href="/#funktioner" class="text-stone-500 hover:text-primary text-sm transition-colors">Funktioner</a>
        <a href="/#priser" class="text-stone-500 hover:text-primary text-sm transition-colors">Priser</a>
        <a href="/brancher/" class="text-stone-500 hover:text-primary text-sm transition-colors">Alle brancher</a>
        <a href="/login.html" class="text-stone-500 hover:text-primary text-sm transition-colors">Log ind</a>
      </div>
    </div>
    <div class="md:text-right">
      <p class="text-stone-600 text-sm mb-1">Mesterbud er bygget i Danmark</p>
      <p class="text-stone-400 text-xs">© 2026 Mesterbud ApS · CVR: 46300831</p>
      <div class="mt-2 space-y-0.5">
        <p class="text-stone-400 text-xs"><a href="mailto:support@mesterbud.dk" class="hover:text-primary transition-colors">support@mesterbud.dk</a></p>
        <p class="text-stone-400 text-xs">Tlf: 42 77 83 66</p>
      </div>
    </div>
  </div>
</footer>
</body>
</html>
"@
  [System.IO.File]::WriteAllText("$base\$($d.slug).html", $html, $utf8)
  Write-Host "OK: $($d.slug).html"
}

# ── TRADE DATA ──────────────────────────────────────────────────────────────────

$trades = @(
  @{
    slug='maler'; nav='Maler'; icon='format_paint'
    titel='Tilbudsprogram til malere – Mesterbud'
    desc='Mesterbud er tilbudssoftware til malere. Send professionelle tilbud på malerarbejde på under 5 minutter. Prøv gratis – ingen kreditkort.'
    kw='tilbudsprogram maler, maler tilbud software, tilbud malerarbejde, malerfirma tilbud app'
    tagline='Tilbudsværktøj til malere'
    h1='Send professionelle malertilbud på under 5 minutter'
    hero='Glem Word og Excel. Med Mesterbud opretter du tilbud til malerarbejde direkte fra telefonen, sender dem til kunden og modtager digital accept – alt fra én app.'
    mockupTitel='Indendørs maling – 3-rums lejlighed'
    linjer=@(,@('Indendørs malerbehandling 2 lag (85 m²)','6.375 kr.'),@('Grundlægning og afvaskning (85 m²)','1.275 kr.'),@('Lister og fodpaneler (42 lbm)','2.100 kr.'),@('Afdækning og bortskaffelse','800 kr.'))
    total='13.188 kr.'
    feat=@(,@('format_paint','Malerskabeloner klar til brug','Typiske malerydelser er klar: indendørs/udendørs maling, lofter, facader og lister. Realistiske m²-priser udfyldes automatisk.'),@('photo_camera','AI analyserer opgavens fotos','Tag et billede af rummet – AI foreslår relevante tilbudslinjer og priser. Spare tid og sæt præcise priser. Kun i Pro.'),@('smartphone','Send tilbud fra varevognen','Opret og send tilbud direkte fra kundens adresse. Kunden accepterer digitalt – ingen papirer frem og tilbage.'))
    faqs=@(,@('Hvad skal et malertilbud indeholde?','Et godt malertilbud bør indeholde beskrivelse af arbejdet, valg af maling og antal lag, pris ekskl. og inkl. moms samt betalingsbetingelser. Mesterbud guider dig igennem det hele automatisk.'),@('Kan jeg lave tilbud på mobilen fra kundens adresse?','Ja. Mesterbud er bygget mobile-first. Du kan oprette, redigere og sende tilbud direkte fra din smartphone – på kundens adresse eller i varevognen.'),@('Hvad koster Mesterbud for malere?','Du starter gratis og sender ét tilbud uden kreditkort. Basis koster 149 kr/md og Pro koster 299 kr/md. Prøveperioden på 14 dage aktiveres når du opretter abonnement.'))
    ctaH2='Send dit første malertilbud gratis i dag'
    ctaTxt='Opret din konto på 2 minutter. Første tilbud er gratis – helt uden kreditkort.'
    fordele='Spar tid på administrationen – brug din tid på at male.'
  },
  @{
    slug='vvs'; nav='VVS'; icon='water_drop'
    titel='Tilbudsprogram til VVS-firmaer – Mesterbud'
    desc='Send professionelle VVS-tilbud på badeværelser, varmesystemer og rørarbejde direkte fra telefonen. Prøv Mesterbud gratis.'
    kw='tilbudsprogram VVS, VVS tilbud software, VVS-installatør tilbud app, badeværelse tilbud program'
    tagline='Tilbudsværktøj til VVS-installatører'
    h1='VVS-tilbud sendt på stedet – fra badeværelset til kundens indbakke'
    hero='Mesterbud er bygget til VVS-installatører der vil bruge mere tid på rørene og mindre tid på papirarbejde. Lav tilbud på badeværelse, varmepumpe og rørservice fra din telefon.'
    mockupTitel='Tilbud – Nyt badeværelse komplet'
    linjer=@(,@('Nyt blandingsbatteri + bruser inkl. montering','4.875 kr.'),@('Håndvask med armatur og afløb','3.200 kr.'),@('Toilet med cisterne og sæde','4.100 kr.'),@('Arbejdsløn (12 timer à 695 kr.)','8.340 kr.'))
    total='25.644 kr.'
    feat=@(,@('plumbing','VVS-prisliste med typiske ydelser','Blandingsbatterier, varmtvandsbeholdere, radiatorer og gulvvarme – typiske VVS-ydelser er klar med realistiske priser.'),@('timer','Timebaseret prissætning','Sæt din timepris én gang. Mesterbud beregner automatisk arbejdslønnen baseret på estimerede timer.'),@('receipt_long','Faktura direkte fra tilbuddet','Når tilbuddet er accepteret, kan du med ét klik oprette en faktura og sende den til kunden.'))
    faqs=@(,@('Hvad bør et VVS-tilbud indeholde?','Et VVS-tilbud bør beskrive arbejdets omfang, specificere materialer og varenumre, angive timepris og estimeret tid samt pris ekskl. og inkl. moms.'),@('Skal jeg angive momsregistreringsnummer på tilbuddet?','Ja, som momsregistreret virksomhed skal CVR og momsregistreringsnummer fremgå. Mesterbud sætter automatisk dit CVR på alle tilbud.'),@('Hvad koster Mesterbud for VVS-firmaer?','Du starter gratis. Basis koster 149 kr/md og Pro koster 299 kr/md med AI-funktioner. Prøveperioden på 14 dage starter når du opretter abonnement.'))
    ctaH2='Send dit første VVS-tilbud gratis i dag'
    ctaTxt='Opret konto på 2 minutter. Første tilbud er gratis – ingen kreditkort kræves.'
    fordele='Brug mere tid på rørene – mindre tid på papirarbejde.'
  },
  @{
    slug='elektriker'; nav='Elektriker'; icon='bolt'
    titel='Tilbudsprogram til elektrikere – Mesterbud'
    desc='Send professionelle el-tilbud på installation, sikringstavle og kabelarbejde direkte fra telefonen. Mesterbud er bygget til elektrikere.'
    kw='tilbudsprogram elektriker, el-installatør tilbud, el tilbud software, elektriker app tilbud'
    tagline='Tilbudsværktøj til el-installatører'
    h1='El-installatørernes tilbudsprogram – fra tavlen til kundens accept'
    hero='Du er på opgaven. Tilbuddet skal sendes. Med Mesterbud gøres det fra telefonen på 5 minutter – med korrekte materialepriser, timepris og digital kundegodkendelse.'
    mockupTitel='Tilbud – El-installation 4-rums lejlighed'
    linjer=@(,@('Stikkontakter og afbrydere (24 stk)','5.760 kr.'),@('Ny fordelerbox 3-faset (16 grupper)','6.200 kr.'),@('Kabelføring og rørinstallation','3.850 kr.'),@('Arbejdsløn (14 timer à 695 kr.)','9.730 kr.'))
    total='31.925 kr.'
    feat=@(,@('bolt','El-skabeloner inkl. materialer','Stikkontakter, afbrydere, tavler og kabeltyper – typiske el-ydelser med realistiske priser er klar til brug.'),@('schedule','Automatisk timeprisberegning','Angiv antal timer – Mesterbud beregner arbejdslønnen automatisk ud fra din timepris.'),@('verified','Certifikatnummer på tilbuddet','Tilføj dit autorisationsnummer direkte på tilbuddet – fremstår professionelt og seriøst overfor kunden.'))
    faqs=@(,@('Hvad skal et el-tilbud indeholde?','Et el-tilbud bør indeholde beskrivelse af arbejdet, materialeliste med varenumre, arbejdsløn pr. time, autorisationsnummer og pris inkl. moms.'),@('Kan jeg sende tilbud på store industriopgaver?','Ja. Du kan oprette tilbud med op til 100 linjer, tilføje bilag og dele tilbuddet som PDF eller via direkte link.'),@('Hvad koster Mesterbud for elektrikere?','Gratis at starte – ét tilbud uden kreditkort. Basis: 149 kr/md. Pro: 299 kr/md med AI-funktioner. Prøveperioden aktiveres ved abonnement.'))
    ctaH2='Send dit første el-tilbud gratis i dag'
    ctaTxt='Opret konto på 2 minutter. Første tilbud er gratis – ingen binding.'
    fordele='Brug din tid på installationsarbejdet – ikke på tilbudsskriving.'
  },
  @{
    slug='toemrer'; nav='Tømrer'; icon='carpenter'
    titel='Tilbudsprogram til tømrere – Mesterbud'
    desc='Send professionelle tømrertilbud på terrasse, vinduer, tag og træarbejde direkte fra telefonen. Prøv Mesterbud gratis.'
    kw='tilbudsprogram tømrer, tømrer tilbud app, tilbud terrassedæk, tømrerfirma software'
    tagline='Tilbudsværktøj til tømrere og tømrermestre'
    h1='Tømrernes tilbudsprogram – fra fundament til kip på 5 minutter'
    hero='Mesterbud giver tømrere og tømrervirksomheder et professionelt tilbudsværktøj direkte i lommen. Lav tilbud på terrasse, vinduer, tag og nybyg fra byggepladsen.'
    mockupTitel='Tilbud – Terrassedæk og overdækning'
    linjer=@(,@('Trykimprægneret terrassedæk 28mm (32 m²)','11.520 kr.'),@('Stolper, hanebånd og rem (fyr)','4.200 kr.'),@('Skruer, beslag og justerbare fødder','1.850 kr.'),@('Montering og bortskaffelse','5.600 kr.'))
    total='28.963 kr.'
    feat=@(,@('carpenter','Tømrerskabeloner med materialer','Terrassedæk, vinduesudskiftning, tagspær og skeletkonstruktion – typiske tømreropgaver med m²- og lbm-priser klar.'),@('straighten','Beregn m², lbm og stk','Angiv mål – Mesterbud beregner mængder og priser automatisk. Spar tid på opmåling og kalkulation.'),@('draw','Tegning og fotos som bilag','Upload plantegning eller byggefoto direkte på tilbuddet. Kunden ser præcis hvad opgaven indebærer.'))
    faqs=@(,@('Hvad skal et tømrertilbud indeholde?','Et tømrertilbud bør indeholde materialebeskrivelse med træsorter og dimensioner, antal m² eller lbm, arbejdsløn og samlet pris inkl. moms.'),@('Kan jeg lave tilbud på store nybyggeriprojekter?','Ja. Mesterbud håndterer op til 100 tilbudslinjer og understøtter store projekter med flere faser.'),@('Hvad koster Mesterbud for tømrere?','Gratis at starte. Basis: 149 kr/md. Pro: 299 kr/md. Prøveperioden på 14 dage aktiveres ved oprettelse af abonnement.'))
    ctaH2='Send dit første tømrertilbud gratis'
    ctaTxt='Opret konto på 2 minutter. Første tilbud er gratis – ingen kreditkort.'
    fordele='Brug din tid på træet – ikke på tilbudsskriving.'
  },
  @{
    slug='murer'; nav='Murer'; icon='home_work'
    titel='Tilbudsprogram til murere – Mesterbud'
    desc='Send professionelle murertilbud på tilbygning, mure og fundamentsarbejde direkte fra byggepladsen. Prøv Mesterbud gratis.'
    kw='tilbudsprogram murer, murer tilbud software, murerfirma tilbud app, tilbud tilbygning'
    tagline='Tilbudsværktøj til murere og murermestre'
    h1='Murerfirmaets mest effektive tilbudsværktøj – send fra byggepladsen'
    hero='Lav præcise tilbud til murerarbejde direkte fra byggepladsen. Kunden underskriver digitalt – ingen papirer, ingen forsinkelse. Mesterbud er bygget til murermestre.'
    mockupTitel='Tilbud – Tilbygning murerarbejde 15 m²'
    linjer=@(,@('Murerarbejde inkl. mørtel (15 m²)','9.750 kr.'),@('Porebeton blokke 15 m² (Ytong 200mm)','4.500 kr.'),@('Fundament og sokkelfuge','3.200 kr.'),@('Bortskaffelse og rengøring','1.200 kr.'))
    total='23.313 kr.'
    feat=@(,@('home_work','Murerskabeloner med m²-priser','Murerarbejde, fundament, flisesætning og facaderenovering – typiske murerydelser med realistiske m²-priser klar til brug.'),@('mic','AI-stemmediktering fra pladsen','Dikter tilbuddet med stemmen direkte fra byggepladsen. AI opretter tilbudslinjer automatisk. Kun i Pro-plan.'),@('contract','Digital accept og PDF','Kunden modtager tilbuddet pr. mail og accepterer med ét klik. Du får besked og kan downloade PDF til dine sager.'))
    faqs=@(,@('Hvad skal et murertilbud indeholde?','Et murertilbud bør beskrive arbejdets omfang, specificere materialerne (bloktype, mørteltype), angive m²-priser og total inkl. moms.'),@('Kan jeg tilføje tegninger til tilbuddet?','Ja. Du kan vedhæfte billeder og tegninger som bilag til tilbuddet – kunden ser præcis hvad der bygges.'),@('Hvad koster Mesterbud for murere?','Gratis at starte. Basis: 149 kr/md. Pro: 299 kr/md med AI-diktering. Prøveperioden aktiveres ved oprettelse af abonnement.'))
    ctaH2='Send dit første murertilbud gratis'
    ctaTxt='Opret konto på 2 minutter. Første tilbud er gratis – ingen binding.'
    fordele='Brug din tid på murstenene – ikke på papirbunker.'
  },
  @{
    slug='tagdaekker'; nav='Tagdækker'; icon='roofing'
    titel='Tilbudsprogram til tagdækkere – Mesterbud'
    desc='Send professionelle tagdækkertilbud på tegl, pap og tagrender direkte fra taget. Prøv Mesterbud gratis – ingen kreditkort.'
    kw='tilbudsprogram tagdækker, tagdækker tilbud app, tag tilbud software, tagfirma tilbud program'
    tagline='Tilbudsværktøj til tagdækkere og tagfirmaer'
    h1='Tagdækkerens tilbudsprogram – send fra taget på 5 minutter'
    hero='Mesterbud er bygget til tagdækkere der vil sende skarpe tilbud hurtigt – fra tagkanten, i varevognen eller derhjemme. Korrekte m²-priser og digital kundegodkendelse.'
    mockupTitel='Tilbud – Udskiftning af tegltag 85 m²'
    linjer=@(,@('Ny tagbelægning – betontegl (85 m²)','38.250 kr.'),@('Undertag + lægter (85 m²)','12.750 kr.'),@('Rygning og tagfodsinddækning','4.500 kr.'),@('Rensning og opsætning af tagrender','3.200 kr.'))
    total='73.438 kr.'
    feat=@(,@('roofing','Tagskabeloner for alle tagtyper','Teglsten, betontegl, tagpap, EPDM og eternit – typiske tagydelser med m²-priser klar. Vælg materiale og juster.'),@('square_foot','m²-beregner til tage','Angiv tagets mål – Mesterbud beregner areal og pris automatisk. Inkl. ryg, sider og udhæng.'),@('thumb_up','Digital accept fra husejer','Kunden modtager tilbuddet pr. mail og godkender det med ét klik – hurtigt og professionelt.'))
    faqs=@(,@('Hvad skal et tagdækkertilbud indeholde?','Et tagdækkertilbud bør beskrive tagtype og materiale, m² og hejseomkostninger, undertagsmateriale, inddækninger samt garanti på arbejdet.'),@('Kan jeg lave tilbud på tagpap og EPDM?','Ja. Mesterbud har skabeloner til alle de mest brugte tagtyper. Du vælger materiale og justerer priser.'),@('Hvad koster Mesterbud for tagdækkere?','Gratis at starte. Basis: 149 kr/md. Pro: 299 kr/md. Prøveperioden på 14 dage aktiveres ved abonnement.'))
    ctaH2='Send dit første tagdækkertilbud gratis'
    ctaTxt='Opret konto på 2 minutter. Første tilbud gratis – ingen kreditkort.'
    fordele='Brug din tid på tagets – ikke på tilbudsskriving.'
  },
  @{
    slug='gulvlaegger'; nav='Gulvlægger'; icon='texture'
    titel='Tilbudsprogram til gulvlæggere – Mesterbud'
    desc='Send professionelle gulvlæggertilbud på parket, laminat, fliser og vinyl med korrekte m²-priser. Prøv Mesterbud gratis.'
    kw='tilbudsprogram gulvlægger, gulvlægger tilbud app, parket tilbud software, gulvfirma tilbud'
    tagline='Tilbudsværktøj til gulvlæggere'
    h1='Tilbudsprogram til gulvlæggere – korrekte m²-priser på sekunder'
    hero='Med Mesterbud laver gulvlæggere præcise tilbud med de rigtige m²-priser, materialespecifikationer og digital kundegodkendelse – alt fra én app på telefonen.'
    mockupTitel='Tilbud – Parket 3-rums lejlighed (45 m²)'
    linjer=@(,@('Parketstav Eg olieret 14mm (45 m²)','18.900 kr.'),@('Afretning med Gyproc 10mm (45 m²)','5.400 kr.'),@('Sokkellist eg 62mm (68 lbm)','2.720 kr.'),@('Afdækning og slutrengøring','800 kr.'))
    total='34.775 kr.'
    feat=@(,@('texture','Gulvskabeloner for alle belægninger','Parket, laminat, vinylplanker, klinker og tæppe – materialespecifikke skabeloner med m²-priser klar til brug.'),@('square_foot','m²-beregner med materialeforbrug','Angiv rummets areal – Mesterbud beregner materialeforbrug inkl. spild og giver præcis pris.'),@('photo_camera','Fotodokumentation af underlag','Upload foto af underlaget – dokumenter tilstanden før og efter til kunden og til egne sager.'))
    faqs=@(,@('Hvad skal et gulvlæggertilbud indeholde?','Et gulvlæggertilbud bør beskrive gulvtype og materiale, m²-pris inkl. og ekskl. underlag, sokkellist, afdækning og bortskaffelse af gammelt gulv.'),@('Kan jeg lave tilbud på flisearbejde?','Ja. Mesterbud har skabeloner til klinker og fliser med m²-priser, fugning og lægning.'),@('Hvad koster Mesterbud for gulvlæggere?','Gratis at starte. Basis: 149 kr/md. Pro: 299 kr/md. Prøveperioden aktiveres ved oprettelse af abonnement.'))
    ctaH2='Send dit første gulvlæggertilbud gratis'
    ctaTxt='Opret konto på 2 minutter. Første tilbud er gratis – ingen binding.'
    fordele='Brug din tid på gulvet – ikke på regneark.'
  },
  @{
    slug='anlaegsgartner'; nav='Anlægsgartner'; icon='yard'
    titel='Tilbudsprogram til anlægsgartnere – Mesterbud'
    desc='Send professionelle gartnertilbud på terrasse, belægning og haveanlæg direkte fra marken. Prøv Mesterbud gratis.'
    kw='tilbudsprogram anlægsgartner, gartner tilbud app, haveanlæg tilbud software, belægning tilbud'
    tagline='Tilbudsværktøj til anlægsgartnere'
    h1='Anlægsgartnernes tilbudsapp – lav tilbud i haven, send til kunden'
    hero='Mesterbud giver anlægsgartnere et simpelt tilbudsværktøj der matcher sæsonens travlhed. Lav hurtige tilbud på terrasser, belægning og beplantning – direkte fra haven.'
    mockupTitel='Tilbud – Privathaveanlæg terrasse og belægning'
    linjer=@(,@('Natursten terrasse 40x40 grå (30 m²)','16.500 kr.'),@('Afretning og stabilgrus 15 cm (30 m²)','4.500 kr.'),@('Kantafgrænsning cortenstål 12 lbm','3.600 kr.'),@('Rydning, jord og bortskaffelse (5 ton)','3.750 kr.'))
    total='35.438 kr.'
    feat=@(,@('yard','Gartner-skabeloner for alle opgaver','Terrasse, flisebelægning, beplantning, hæk og græsplæne – typiske gartnerskabeloner med realistiske priser klar.'),@('wb_sunny','Sæsonpriser og rabatter','Tilpas priser til sæsonen. Giv mængderabat direkte i tilbuddet. Nem og professionel prisstrategi.'),@('smartphone','Send tilbud direkte fra haven','Opret og send tilbuddet mens du er ved kunden. Kunden accepterer samme dag – ingen opfølgning nødvendig.'))
    faqs=@(,@('Hvad skal et anlægsgartnertilbud indeholde?','Et gartnertilbud bør beskrive anlægstype, materialer og mængder i m² eller stk, bortskaffelse af jord og gammelt anlæg samt arbejdsløn.'),@('Kan jeg lave abonnementstilbud på havepasning?','Ja. Du kan oprette tilbud med fast månedspris på vedligehold, klipning og pleje – kunden accepterer digitalt.'),@('Hvad koster Mesterbud for anlægsgartnere?','Gratis at starte. Basis: 149 kr/md. Pro: 299 kr/md. Prøveperioden på 14 dage aktiveres ved abonnement.'))
    ctaH2='Send dit første gartnertilbud gratis'
    ctaTxt='Opret konto på 2 minutter. Første tilbud gratis – ingen kreditkort.'
    fordele='Brug din tid på haven – ikke på papirbunker.'
  },
  @{
    slug='mekaniker'; nav='Mekaniker'; icon='car_repair'
    titel='Tilbudsprogram til mekanikere og autoværksteder – Mesterbud'
    desc='Send professionelle reparationsoverslag og værkstedstilbud til bilkunderne direkte fra telefonen. Prøv Mesterbud gratis.'
    kw='tilbudsprogram mekaniker, værksted tilbud app, bil reparation tilbud, autoværksted software'
    tagline='Tilbudsværktøj til autoværksteder'
    h1='Værkstedets tilbudsprogram – hurtige overslag direkte til kunden'
    hero='Med Mesterbud sender bilmekanikere professionelle overslag og reparationstilbud til kunderne – fra diagnostikken til fakturaen. Hurtigt, præcist og uden papirrod.'
    mockupTitel='Tilbud – Service og bremseopbygning'
    linjer=@(,@('Koblingssæt inkl. frihjul og montering','4.850 kr.'),@('Bremseskiver + klodser for aksel','2.980 kr.'),@('Olie, filtre og serviceydelse','1.450 kr.'),@('Arbejdsløn (3,5 timer à 895 kr.)','3.133 kr.'))
    total='15.516 kr.'
    feat=@(,@('car_repair','Værkstedsskabeloner til alle opgaver','Service, bremser, kobling, gearkasse og dæk – typiske værkstedsydelser med reservedelspriser og timesats klar.'),@('inventory','Varenumre og reservedele','Tilføj OEM- eller eftermarkedsnumre direkte på tilbudslinjen. Kunden ser præcis hvilke dele der bruges.'),@('thumb_up','Hurtig kundegodkendelse','Send overslaget til kunden pr. SMS eller mail. Kunden godkender med ét klik – du kan gå i gang med det samme.'))
    faqs=@(,@('Hvad skal et værkstedstilbud indeholde?','Et værkstedstilbud bør angive registreringsnummer, beskrivelse af arbejdet, reservedelsnumre, timepris og samlet pris inkl. moms.'),@('Kan jeg sende tilbud på syn og klargøring?','Ja. Du kan oprette tilbud på alt fra periodisk service til klargøring til syn og større reparationer.'),@('Hvad koster Mesterbud for værksteder?','Gratis at starte. Basis: 149 kr/md. Pro: 299 kr/md. Prøveperioden på 14 dage starter når du opretter abonnement.'))
    ctaH2='Send dit første værkstedstilbud gratis'
    ctaTxt='Opret konto på 2 minutter. Første tilbud gratis – ingen binding.'
    fordele='Brug din tid under motorhjelmen – ikke på tilbudsskriving.'
  },
  @{
    slug='kloakmester'; nav='Kloakmester'; icon='water'
    titel='Tilbudsprogram til kloakmestre – Mesterbud'
    desc='Send professionelle kloaktilbud på TV-inspektion, strømpeforing og brøndsætning direkte fra telefonen. Prøv Mesterbud gratis.'
    kw='tilbudsprogram kloakmester, kloak tilbud app, strømpeforing tilbud, kloakfirma software'
    tagline='Tilbudsværktøj til kloakmestre og kloakfirmaer'
    h1='Kloakmesterens tilbudssoftware – fra inspektion til underskrift'
    hero='Mesterbud giver kloakmestre og kloakfirmaer et hurtigt tilbudsværktøj der dækker alt fra TV-inspektion til strømpeforing, brøndsætning og separatkloakering.'
    mockupTitel='Tilbud – Kloakrenovering og strømpeforing'
    linjer=@(,@('TV-inspektion (25 lbm inkl. rapport)','3.125 kr.'),@('Strømpeforing DN150 (8 lbm)','14.400 kr.'),@('Brøndopbygning PP + betonring + dæksel','5.800 kr.'),@('Udgravning, retablering og asfaltering','8.500 kr.'))
    total='39.781 kr.'
    feat=@(,@('water','Kloakskabeloner til alle opgaver','TV-inspektion, strømpeforing, brøndsætning, separatkloakering og rensning – skabeloner med lbm- og stk-priser klar.'),@('photo_camera','Fotodokumentation fra inspektionen','Upload kloakfoto og TV-inspektionsrapport direkte på tilbuddet som bilag. Professionel og dokumenteret.'),@('verified','Autorisationsnummer på tilbuddet','Dit kloakmesterautorisationsnummer fremgår automatisk på alle tilbud – korrekt og professionelt.'))
    faqs=@(,@('Hvad skal et kloaktilbud indeholde?','Et kloaktilbud bør beskrive arbejdsomfang i lbm, metode (strømpeforing, udgravning), materialer, autorisationsnummer og pris inkl. moms.'),@('Kan jeg vedhæfte TV-inspektionsrapporten?','Ja. Du kan uploade og vedhæfte filer direkte på tilbuddet – kunden får dem samlet i én e-mail.'),@('Hvad koster Mesterbud for kloakmestre?','Gratis at starte. Basis: 149 kr/md. Pro: 299 kr/md. Prøveperioden aktiveres ved oprettelse af abonnement.'))
    ctaH2='Send dit første kloaktilbud gratis'
    ctaTxt='Opret konto på 2 minutter. Første tilbud gratis – ingen kreditkort.'
    fordele='Brug din tid på rørene – ikke på papirarbejde.'
  },
  @{
    slug='snedker'; nav='Snedker'; icon='handyman'
    titel='Tilbudsprogram til snedkere – Mesterbud'
    desc='Send professionelle snedkertilbud på specialmøbler, køkkener, vinduer og inventar direkte fra telefonen. Prøv Mesterbud gratis.'
    kw='tilbudsprogram snedker, snedker tilbud app, køkken tilbud software, inventar tilbud snedker'
    tagline='Tilbudsværktøj til snedkere og snedkermestre'
    h1='Snedkerens tilbudsprogram – til skræddersyet træarbejde og kundeprojekter'
    hero='Mesterbud giver snedkermestre et fleksibelt tilbudsværktøj der håndterer alt fra specialfremstillede møbler til vinduer, døre og inventarindretning – professionelt og hurtigt.'
    mockupTitel='Tilbud – Specialfremstillet køkken inkl. montering'
    linjer=@(,@('MDF-fronter med spraymaling (12 låger)','14.400 kr.'),@('Underskabe og overskabe (8 sek.)','19.200 kr.'),@('Bordplade laminat m/ udskæring (3,2 lbm)','4.800 kr.'),@('Montering og tilpasning på stedet','6.400 kr.'))
    total='56.250 kr.'
    feat=@(,@('handyman','Snedkerskabeloner til alle opgaver','Køkkener, garderobeskabe, vinduer, døre og specialinventar – fleksible skabeloner du tilpasser til hvert projekt.'),@('attach_file','Tegning og 3D-skitse som bilag','Upload plantegning, prospekt eller 3D-visualisering direkte på tilbuddet. Kunden ved præcis hvad de får.'),@('receipt_long','Faktura fra tilbuddet','Når kunden har accepteret, opretter du fakturaen med ét klik. Ingen dobbeltindtastning.'))
    faqs=@(,@('Hvad skal et snedkertilbud indeholde?','Et snedkertilbud bør beskrive materialer og overfladebehandling, mål og dimensioner, montering og tilpasning på stedet samt pris inkl. moms.'),@('Kan jeg lave tilbud på løbende vedligehold?','Ja. Du kan oprette tilbud på vedligehold, lakering og reparation af eksisterende inventar eller møbler.'),@('Hvad koster Mesterbud for snedkere?','Gratis at starte. Basis: 149 kr/md. Pro: 299 kr/md. Prøveperioden på 14 dage aktiveres ved abonnement.'))
    ctaH2='Send dit første snedkertilbud gratis'
    ctaTxt='Opret konto på 2 minutter. Første tilbud gratis – ingen kreditkort.'
    fordele='Brug din tid i værkstedet – ikke på tilbudsskriving.'
  },
  @{
    slug='blikkenslager'; nav='Blikkenslager'; icon='roofing'
    titel='Tilbudsprogram til blikkenslagere – Mesterbud'
    desc='Send professionelle blikkenslagertilbud på tagrender, inddækninger og ventilation direkte fra telefonen. Prøv Mesterbud gratis.'
    kw='tilbudsprogram blikkenslager, blikkenslager tilbud app, tagrender tilbud software, inddækning tilbud'
    tagline='Tilbudsværktøj til blikkenslagere'
    h1='Tilbudsprogram til blikkenslagere – hurtigt og præcist'
    hero='Med Mesterbud sender blikkenslagere tilbud på tagrender, inddækninger, zinktage og ventilationsanlæg direkte fra telefonen – korrekte lbm-priser og digital accept.'
    mockupTitel='Tilbud – Tagrender og tagudhæng kobber'
    linjer=@(,@('Kobbertagrende ø100 (14 lbm)','7.000 kr.'),@('Kobber nedløbsrør ø76 (2 x 4 m)','4.800 kr.'),@('Tagudhæng og zinkinddækning (8 lbm)','4.400 kr.'),@('Montering, lodning og tætning','3.800 kr.'))
    total='25.000 kr.'
    feat=@(,@('roofing','Blikkenslagerskabeloner klar til brug','Tagrender, nedløb, inddækninger, zinktag og ventilation – typiske ydelser med lbm- og stk-priser klar.'),@('straighten','lbm- og m²-beregner','Angiv længde og mål – Mesterbud beregner materiale og pris automatisk. Spar tid på kalkulation.'),@('photo_camera','Dokumentation med fotos','Upload fotos af det eksisterende tag og inddækning. Kunden ser tydeligt hvad der udskiftes og hvorfor.'))
    faqs=@(,@('Hvad skal et blikkenslagertilbud indeholde?','Et blikkenslagertilbud bør beskrive materialevalg (kobber, zink, stål), dimensioner i lbm eller m², montering og pris inkl. moms.'),@('Kan jeg lave tilbud på ventilationsanlæg?','Ja. Du kan bruge Mesterbud til alle blikkenslagerfaglige opgaver – fra tagrender til ventilationskanaler.'),@('Hvad koster Mesterbud for blikkenslagere?','Gratis at starte. Basis: 149 kr/md. Pro: 299 kr/md. Prøveperioden aktiveres ved abonnement.'))
    ctaH2='Send dit første blikkenslagertilbud gratis'
    ctaTxt='Opret konto på 2 minutter. Første tilbud gratis – ingen binding.'
    fordele='Brug din tid på tagrenner og inddækninger – ikke på papirarbejde.'
  },
  @{
    slug='glarmester'; nav='Glarmester'; icon='window'
    titel='Tilbudsprogram til glarmestre – Mesterbud'
    desc='Send professionelle glarmestertilbud på termoruder, facadeglas og vinduesudskiftning direkte fra telefonen. Prøv Mesterbud gratis.'
    kw='tilbudsprogram glarmester, glarmester tilbud app, termorude tilbud software, glas tilbud program'
    tagline='Tilbudsværktøj til glarmestre'
    h1='Glarmesternes tilbudssoftware – hurtige overslag på glasopgaver'
    hero='Mesterbud giver glarmestre et hurtigt og professionelt tilbudsværktøj til glasudskiftning, termoruder, facadeglas og butiksruder – send fra stedet på 5 minutter.'
    mockupTitel='Tilbud – Termoruder 3-lags udskiftning'
    linjer=@(,@('3-lags termorude energiglas (4 stk)','14.400 kr.'),@('Forsænket bundkarm + glasliste','2.800 kr.'),@('Forseglingsprofil og fugemasse','850 kr.'),@('Montering og bortskaffelse af gammel rude','3.600 kr.'))
    total='26.813 kr.'
    feat=@(,@('window','Glarmesterskabeloner til alle opgaver','Termoruder, facadeglas, butiksruder og tagvinduer – skabeloner med stk- og m²-priser klar til brug.'),@('square_foot','Stk- og m²-beregner','Angiv mål – Mesterbud beregner areal og pris automatisk inkl. karmbredde og montering.'),@('verified','U-værdi og energispecifikationer','Angiv energiklasse og U-værdi direkte på tilbudslinjen – korrekt dokumentation til kunden.'))
    faqs=@(,@('Hvad skal et glarmestertilbud indeholde?','Et glarmestertilbud bør beskrive glastype, energiklasse og U-værdi, dimensioner i m², montering og bortskaffelse af gammel rude samt pris inkl. moms.'),@('Kan jeg lave tilbud på brudskader og akutopgaver?','Ja. Mesterbud er mobilvenlig og du kan oprette og sende et tilbud fra stedet på under 5 minutter.'),@('Hvad koster Mesterbud for glarmestre?','Gratis at starte. Basis: 149 kr/md. Pro: 299 kr/md. Prøveperioden aktiveres ved oprettelse af abonnement.'))
    ctaH2='Send dit første glarmestertilbud gratis'
    ctaTxt='Opret konto på 2 minutter. Første tilbud gratis – ingen binding.'
    fordele='Brug din tid på glasset – ikke på regneark og Word-filer.'
  },
  @{
    slug='isolatoer'; nav='Isolatør'; icon='layers'
    titel='Tilbudsprogram til isolatører – Mesterbud'
    desc='Send professionelle isolatørtilbud på loftisolering, hulmursisolering og energirenovering direkte fra telefonen. Prøv Mesterbud gratis.'
    kw='tilbudsprogram isolatør, isolering tilbud app, energirenovering tilbud software, hulmursisolering tilbud'
    tagline='Tilbudsværktøj til isolatører og isoleringsfirmaer'
    h1='Isoleringsfirmaets tilbudsprogram – energirenovering gjort enkelt'
    hero='Med Mesterbud sender isolatører præcise tilbud på loft-, hulmurs- og kryberumisolering med korrekte m²-priser, materialespecifikationer og digital accept.'
    mockupTitel='Tilbud – Energirenovering komplet isolering'
    linjer=@(,@('Loftisolering 200mm Rockwool (85 m²)','17.000 kr.'),@('Hulmursisolering EPS-granulat (60 m²)','12.600 kr.'),@('Dampspærre PE-folie + teip','2.100 kr.'),@('Montering, rengøring og bortskaffelse','3.800 kr.'))
    total='44.375 kr.'
    feat=@(,@('layers','Isolatørskabeloner til alle metoder','Loft, hulmur, terrændæk, kryberum og facadeisolering – skabeloner med m²-priser og materialeangivelse klar.'),@('eco','Energibesparelse på tilbuddet','Angiv den estimerede energibesparelse i kWh/år direkte på tilbuddet. Stærkt salgsargument for kunden.'),@('verified_user','Myndighedskrav og tilskud','Inkludér info om BR20-krav og mulighed for energitilskud fra Energistyrelsen direkte i tilbuddets noter.'))
    faqs=@(,@('Hvad skal et isolatørtilbud indeholde?','Et isolatørtilbud bør beskrive isoleringstype og tykkelse, m²-priser, materialeproducent, dampspærre og forventet energibesparelse.'),@('Kan jeg lave tilbud med Rockwool og Isover priser?','Ja. Du kan angive producent og produktnavn direkte på tilbudslinjen. Kunden ser præcis hvilket produkt der bruges.'),@('Hvad koster Mesterbud for isolatører?','Gratis at starte. Basis: 149 kr/md. Pro: 299 kr/md. Prøveperioden på 14 dage aktiveres ved abonnement.'))
    ctaH2='Send dit første isolatørtilbud gratis'
    ctaTxt='Opret konto på 2 minutter. Første tilbud gratis – ingen kreditkort.'
    fordele='Brug din tid på isoleringsarbejdet – ikke på tilbudsskriving.'
  },
  @{
    slug='brolaegger'; nav='Brolægger'; icon='grid_on'
    titel='Tilbudsprogram til brolæggere – Mesterbud'
    desc='Send professionelle brolæggertilbud på fliser, chaussésten og belægningsarbejde direkte fra arbejdspladsen. Prøv Mesterbud gratis.'
    kw='tilbudsprogram brolægger, brolægger tilbud app, fliser tilbud software, belægning tilbud program'
    tagline='Tilbudsværktøj til brolæggere og belægningsfirmaer'
    h1='Brolæggerens tilbudsapp – fra opmåling til kundens underskrift'
    hero='Mesterbud giver brolæggere og belægningsfirmaer et hurtigt tilbudsværktøj med præcise m²-priser på fliser, chaussésten og belægningsopgaver – direkte fra arbejdspladsen.'
    mockupTitel='Tilbud – Privat indkørsel og terrasse'
    linjer=@(,@('Betonfliser grå 40x40 (30 m²)','9.000 kr.'),@('Kantafgrænsning vejsten (22 lbm)','2.200 kr.'),@('Stabilgrus 0-16 afretning 15 cm','4.500 kr.'),@('Udgravning og bortskaffelse jord (6 ton)','4.800 kr.'))
    total='25.625 kr.'
    feat=@(,@('grid_on','Brolæggerskabeloner til alle belægninger','Betonfliser, chaussésten, granit, asfalt og grusbelægning – m²-priser og materialetyper klar til brug.'),@('square_foot','m²- og ton-beregner','Angiv opmålte mål – Mesterbud beregner materialmængder, jordvolumen og pris automatisk.'),@('photo_camera','Fotos og opmålingsbilag','Upload opmålingsskitse og fotos direkte på tilbuddet. Kunden kan se præcis hvad der er planlagt.'))
    faqs=@(,@('Hvad skal et brolæggertilbud indeholde?','Et brolæggertilbud bør beskrive belægningstype, m²-pris, underlagsopbygning (grus, stabilgrus, sand), bortskaffelse af jord og arbejdsløn.'),@('Kan jeg lave tilbud på store parkeringsanlæg?','Ja. Mesterbud håndterer op til 100 tilbudslinjer og understøtter store erhvervsprojekter.'),@('Hvad koster Mesterbud for brolæggere?','Gratis at starte. Basis: 149 kr/md. Pro: 299 kr/md. Prøveperioden aktiveres ved oprettelse af abonnement.'))
    ctaH2='Send dit første brolæggertilbud gratis'
    ctaTxt='Opret konto på 2 minutter. Første tilbud gratis – ingen binding.'
    fordele='Brug din tid på belægningen – ikke på kalkulation og tilbudsskriving.'
  },
  @{
    slug='laasesmed'; nav='Låsesmed'; icon='lock'
    titel='Tilbudsprogram til låsesmede – Mesterbud'
    desc='Send professionelle låsesmedtilbud på cylinderskift, adgangskontrol og sikkerhedsbeslag direkte fra telefonen. Prøv Mesterbud gratis.'
    kw='tilbudsprogram låsesmed, låsesmed tilbud app, cylinder tilbud software, adgangskontrol tilbud'
    tagline='Tilbudsværktøj til låsesmede'
    h1='Låsesmedens tilbudsprogram – hurtige svar og professionelle tilbud'
    hero='Med Mesterbud sender låsesmede professionelle tilbud på cylinderskift, adgangskontrol og sikkerhedsbeslag på under 5 minutter – fra kundens dør eller i varevognen.'
    mockupTitel='Tilbud – Sikkerhedsopgradering lejlighed'
    linjer=@(,@('Abloy Protec2 sikkerhedscylinder','3.200 kr.'),@('Sikkerhedsbeslag + skjold syrefast stål','1.850 kr.'),@('Dørspion vidvinkel + kædelås','480 kr.'),@('Montering og nøglekopi (5 stk)','1.200 kr.'))
    total='8.413 kr.'
    feat=@(,@('lock','Låsesmedskabeloner til alle opgaver','Cylinderskift, adgangskontrol, nødåbning og postkasselåse – typiske ydelser med produkt og pris klar.'),@('inventory','Mærke og varenummer på tilbuddet','Angiv Abloy, ASSA, Keso eller andet mærke direkte på tilbudslinjen – professionelt og transparent.'),@('bolt','Akut tilbud fra telefonen','Opret tilbud fra kundens dør på 2 minutter. Send pr. SMS eller mail – kunden godkender på stedet.'))
    faqs=@(,@('Hvad skal et låsesmedtilbud indeholde?','Et låsesmedtilbud bør angive cylindermærke og model, sikkerhedsklasse, antal nøgler inkluderet, montering og pris inkl. moms.'),@('Kan jeg lave tilbud på adgangskontrolsystemer?','Ja. Mesterbud er fleksibelt og du kan oprette tilbud på alt fra simpelt cylinderskift til komplette adgangskontrolanlæg.'),@('Hvad koster Mesterbud for låsesmede?','Gratis at starte. Basis: 149 kr/md. Pro: 299 kr/md. Prøveperioden på 14 dage aktiveres ved abonnement.'))
    ctaH2='Send dit første låsesmedtilbud gratis'
    ctaTxt='Opret konto på 2 minutter. Første tilbud gratis – ingen binding.'
    fordele='Brug din tid på kundernes sikkerhed – ikke på tilbudsskriving.'
  },
  @{
    slug='smed'; nav='Smed'; icon='hardware'
    titel='Tilbudsprogram til smede – Mesterbud'
    desc='Send professionelle smedtilbud på stakit, gelændere, svejsearbejde og specialfremstilling direkte fra telefonen. Prøv Mesterbud gratis.'
    kw='tilbudsprogram smed, smed tilbud app, stakit tilbud software, svejsearbejde tilbud'
    tagline='Tilbudsværktøj til smede og metalværksteder'
    h1='Smedenes tilbudsværktøj – til jern, stål og specialfremstilling'
    hero='Mesterbud giver smede og metalværksteder et fleksibelt tilbudsværktøj til specialopgaver, stakit, gelændere, svejsearbejde og metalindretning – professionelt og hurtigt.'
    mockupTitel='Tilbud – Galvaniseret stakit og indgangsport'
    linjer=@(,@('Galvaniseret stakit spids top (8 lbm)','6.400 kr.'),@('Indgangsport med hængsler og lås','8.500 kr.'),@('Pulverlakering i RAL9005 sort','3.200 kr.'),@('Montering, forankring og retablering','4.800 kr.'))
    total='28.625 kr.'
    feat=@(,@('hardware','Smedeskabeloner til alle opgaver','Stakit, gelændere, trapper, porte og specialkonstruktioner – fleksible skabeloner du tilpasser til hvert projekt.'),@('straighten','Materiale og timepris','Angiv kg stål, lbm profil eller stk – Mesterbud beregner materialepris og tillægger din timesats automatisk.'),@('attach_file','Tegning og teknisk specifikation','Upload teknisk tegning eller foto direkte som bilag på tilbuddet. Kunden ser præcis hvad de bestiller.'))
    faqs=@(,@('Hvad skal et smedtilbud indeholde?','Et smedtilbud bør beskrive materialetype og overflade (galvaniseret, pulverlak), dimensioner, kg eller lbm, arbejdsløn og pris inkl. moms.'),@('Kan jeg lave tilbud på store industriopgaver?','Ja. Mesterbud håndterer op til 100 tilbudslinjer og understøtter projekter med mange delkomponenter og faser.'),@('Hvad koster Mesterbud for smede?','Gratis at starte. Basis: 149 kr/md. Pro: 299 kr/md. Prøveperioden på 14 dage aktiveres ved abonnement.'))
    ctaH2='Send dit første smedtilbud gratis'
    ctaTxt='Opret konto på 2 minutter. Første tilbud gratis – ingen kreditkort.'
    fordele='Brug din tid på metallet – ikke på tilbudsskriving og regneark.'
  },
  @{
    slug='stilladsbygger'; nav='Stilladsbygger'; icon='apartment'
    titel='Tilbudsprogram til stilladsbyggere – Mesterbud'
    desc='Send professionelle stilladsbudt på facade, tag og renovering direkte fra telefonen. Prøv Mesterbud gratis – ingen kreditkort.'
    kw='tilbudsprogram stilladsbygger, stillads tilbud app, facadestillads tilbud, stilladsudlejning software'
    tagline='Tilbudsværktøj til stilladsbyggere og stilladsvirksomheder'
    h1='Stilladsbyggerens tilbudsprogram – klart og overskueligt'
    hero='Med Mesterbud sender stilladsvirksomheder præcise leje- og opsætningstilbud til bygherrer og håndværkere på under 5 minutter – inkl. lejeperiode og forlængelsesoption.'
    mockupTitel='Tilbud – Facadestillads boligblok'
    linjer=@(,@('Facadestillads 80 m² × 4 uger leje','16.000 kr.'),@('Montering og nedtagning','8.000 kr.'),@('Gelænder, bundbrædder og sikkerhedsnet','3.200 kr.'),@('Fundament-tilpasning og ankre','2.400 kr.'))
    total='37.000 kr.'
    feat=@(,@('apartment','Stillads-skabeloner til alle opgaver','Facadestillads, tagstillads, indvendig stillads og hængestillads – skabeloner med m² × uge-priser klar.'),@('calendar_month','Lejeperiode og forlængelsesoption','Angiv lejeperiode og ugepris direkte. Tilbuddet viser tydeligt hvad der sker ved forlængelse.'),@('verified_user','Sikkerhed og CE-dokumentation','Inkludér info om CE-certificering og sikkerhedsgodkendelse direkte i tilbuddets noter.'))
    faqs=@(,@('Hvad skal et stilladsbudt indeholde?','Et stilladsbudt bør angive m² stillet areal, lejeperiode i uger, montering og nedtagning, sikkerhedsudstyr og ugepris ved forlængelse.'),@('Kan jeg lave tilbud på indvendigt stillads?','Ja. Mesterbud er fleksibelt og understøtter alle stilladstyper – facade, tag, indvendig og hængestillads.'),@('Hvad koster Mesterbud for stilladsbyggere?','Gratis at starte. Basis: 149 kr/md. Pro: 299 kr/md. Prøveperioden på 14 dage aktiveres ved abonnement.'))
    ctaH2='Send dit første stilladsbudt gratis'
    ctaTxt='Opret konto på 2 minutter. Første tilbud gratis – ingen kreditkort.'
    fordele='Brug din tid på stilladset – ikke på tilbudsskriving.'
  },
  @{
    slug='servicevirksomhed'; nav='Servicevirksomhed'; icon='cleaning_services'
    titel='Tilbudsprogram til servicevirksomheder – Mesterbud'
    desc='Send professionelle servicetilbud på rengøring, vedligehold og serviceopgaver direkte fra telefonen. Prøv Mesterbud gratis.'
    kw='tilbudsprogram servicevirksomhed, rengøring tilbud app, vedligehold tilbud software, serviceaftale program'
    tagline='Tilbudsværktøj til service- og rengøringsvirksomheder'
    h1='Servicevirksomhedens tilbudsprogram – til rengøring, vedligehold og serviceopgaver'
    hero='Mesterbud er idéelt til service- og rengøringsvirksomheder der vil sende abonnements- og opgavetilbud professionelt og hurtigt – og modtage digital kundegodkendelse.'
    mockupTitel='Tilbud – Erhvervsrengøringsaftale 1 år'
    linjer=@(,@('Ugentlig erhvervsrengøring 250 m² (× 52)','72.800 kr.'),@('Vinduespolering månedlig (× 12)','14.400 kr.'),@('Snerydning og saltning sæson','8.500 kr.'),@('Periodisk AMS-rengøring (× 4)','6.000 kr.'))
    total='126.750 kr.'
    feat=@(,@('cleaning_services','Serviceaftale-skabeloner klar til brug','Rengøring, vinduespolering, haveservice, snerydning og ejendomsservice – typiske serviceydelser med priser klar.'),@('repeat','Abonnementspriser og faste aftaler','Opret tilbud med månedlig fast pris. Kunden accepterer digitalt og du fakturerer løbende.'),@('contract','Digital kontrakt og serviceaftale','Tilbuddet fungerer som grundlag for serviceaftalen. Kunden underskriver digitalt – ingen papirer.'))
    faqs=@(,@('Hvad skal et servicetilbud indeholde?','Et servicetilbud bør beskrive opgavernes hyppighed, m² eller omfang, pris pr. besøg eller fast månedspris samt opsigelsesvarsel.'),@('Kan jeg lave tilbud på engangsopgaver og faste aftaler?','Ja. Mesterbud understøtter både engangsopgaver og løbende serviceaftaler med fast månedspris.'),@('Hvad koster Mesterbud for servicevirksomheder?','Gratis at starte. Basis: 149 kr/md. Pro: 299 kr/md. Prøveperioden på 14 dage aktiveres ved oprettelse af abonnement.'))
    ctaH2='Send dit første servicetilbud gratis'
    ctaTxt='Opret konto på 2 minutter. Første tilbud gratis – ingen binding.'
    fordele='Brug din tid på serviceopgaverne – ikke på tilbudsskriving.'
  },
  @{
    slug='anden-haandvaerker'; nav='Anden håndværker'; icon='build'
    titel='Tilbudsprogram til håndværkere – Mesterbud'
    desc='Mesterbud er tilbudssoftware til alle håndværksfag. Send professionelle tilbud fra din telefon på under 5 minutter. Prøv gratis.'
    kw='tilbudsprogram håndværker, håndværker tilbud app, tilbud software håndværk, tilbudsværktøj håndværker'
    tagline='Tilbudsværktøj til alle håndværksfag'
    h1='Tilbudsprogram til alle håndværksfag – fleksibelt og klar til brug'
    hero='Uanset hvilket håndværksfag du arbejder i, giver Mesterbud dig et hurtigt og professionelt tilbudsværktøj der passer til netop dit arbejde – fra telefonen til kundens accept.'
    mockupTitel='Tilbud – Kombineret håndværksopgave'
    linjer=@(,@('Fagligt arbejde 8 timer à 695 kr.','5.560 kr.'),@('Materialer og forbrugsstoffer','2.800 kr.'),@('Transport og kørsel','650 kr.'),@('Administration og dokumentation','500 kr.'))
    total='11.888 kr.'
    feat=@(,@('build','Tilpas skabeloner til dit fag','Start med en af vores 20 brancheskabeloner og tilpas den til netop dit fag og dine priser.'),@('add_circle','Tilføj dine egne prislinjer','Opret dine egne standardlinjer med faste priser. Genbrugt på alle fremtidige tilbud.'),@('thumb_up','Send og modtag digital accept','Kunden modtager tilbuddet pr. mail og accepterer med ét klik. Du får besked med det samme.'))
    faqs=@(,@('Virker Mesterbud for mit specifikke fag?','Ja. Mesterbud er fleksibelt og kan bruges til alle håndværksfag. Du vælger den tættest relaterede skabelon og tilpasser den til dit arbejde.'),@('Kan jeg tilpasse priserne til min region og mine satser?','Ja. Du sætter din egen timepris og justerer alle materialepriser. Mesterbud beregner automatisk.'),@('Hvad koster Mesterbud?','Gratis at starte med ét tilbud. Basis koster 149 kr/md og Pro koster 299 kr/md. Prøveperioden på 14 dage aktiveres når du opretter abonnement.'))
    ctaH2='Send dit første tilbud gratis i dag'
    ctaTxt='Opret konto på 2 minutter. Første tilbud gratis – ingen kreditkort kræves.'
    fordele='Brug din tid på håndværket – ikke på papirarbejde og regneark.'
  }
)

foreach ($t in $trades) { gen $t }
Write-Host "Alle 20 sider genereret!"

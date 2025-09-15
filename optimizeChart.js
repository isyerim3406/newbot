// optimizeChart.js
async function optimizeChart(page) {
  await page.evaluate(() => {
    // === Fiyat ekseni (sağdaki fiyat paneli) ===
    document.querySelectorAll('.price-axis')
      .forEach(el => el.style.display = 'none');

    // === Zaman ekseni (alttaki tarih paneli) ===
    document.querySelectorAll('.time-axis')
      .forEach(el => el.style.display = 'none');

    // === Grid çizgileri ===
    document.querySelectorAll('.chart-markup-table')
      .forEach(el => el.style.display = 'none');

    // === Mum/bar/çubuk grafikleri ===
    document.querySelectorAll('canvas')
      .forEach(el => {
        // Strateji çizgilerini sakla
        if (el.parentElement?.className?.includes('price-axis') ||
            el.parentElement?.className?.includes('time-axis') ||
            el.parentElement?.className?.includes('chart-container')) {
          el.style.display = 'none';
        }
      });

    // === Sol araç çubuğu ===
    document.querySelectorAll('.drawing-toolbar, .layout__area--left')
      .forEach(el => el.style.display = 'none');

    // === Üst menü ===
    document.querySelectorAll('.chart-controls-bar, .header-toolbar')
      .forEach(el => el.style.display = 'none');
  });
}

export default optimizeChart;

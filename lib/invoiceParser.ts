import PDFParser from 'pdf2json';

function dec(s: string): string {
  try { return decodeURIComponent(s); }
  catch {
    try { return decodeURIComponent(s.replace(/%(?![0-9A-Fa-f]{2})/g, '%25')); }
    catch { return s; }
  }
}

const num = (s: string): number => {
  // "1 994,96" / "29,49" / "583,82" -> 1994.96
  const c = s.replace(/\s/g, '').replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
  return parseFloat(c) || 0;
};

type Word = { x: number; y: number; s: string };
export type ParsedItem = {
  code: string;
  name: string;
  qty: number;
  purchase: number;   // нетто за одиницю
  vat: number;
  isDelivery: boolean;
};

const DELIVERY = /^(dostawa|wysy[łl]ka|delivery|przesy[łl]ka|transport)/i;

export function parseInvoice(buffer: Buffer): Promise<{ items: ParsedItem[] }> {
  return new Promise((resolve, reject) => {
    const parser = new PDFParser();
    parser.on('pdfParser_dataError', (e: any) => reject(e?.parserError || e));
    parser.on('pdfParser_dataReady', (data: any) => {
      try {
        const words: Word[] = [];
        for (const page of data.Pages) {
          for (const t of page.Texts) {
            words.push({ x: t.x, y: Math.round(t.y * 2) / 2, s: dec(t.R.map((r: any) => r.T).join('')) });
          }
        }
        // групуємо у рядки за y
        const byY: Record<number, Word[]> = {};
        words.forEach(w => { (byY[w.y] = byY[w.y] || []).push(w); });

        // Збираємо кожен рядок у суцільний текст.
        // Склеювання за x-проміжком: < GLUE — впритул (одна "літера-група"),
        // інакше пробіл. Для per-letter PDF літери зливаються в слова.
        function lineText(toks: Word[]): string {
          const sorted = toks.slice().sort((a, b) => a.x - b.x);
          let out = '';
          let prevX = -999;
          const GLUE = 0.5;
          for (const t of sorted) {
            if (out === '') out = t.s;
            else if (t.x - prevX < GLUE) out += t.s;
            else out += ' ' + t.s;
            prevX = t.x;
          }
          return out.replace(/\s+/g, ' ').trim();
        }

        const textLines = Object.keys(byY).map(Number).sort((a, b) => a - b)
          .map(y => lineText(byY[y]));

        const items: ParsedItem[] = [];

        // Регулярка товарного рядка (польські фактури):
        //  ^№  [код?]  назва  кількість(szt/pcs)  ... ставка(VAT) ...
        // Числа польські: "1 994,96" / "29,49" / "2698,5100".
        const NUM = '\\d[\\d \\u00a0]*[.,]\\d+|\\d[\\d \\u00a0]*';
        const reLine = new RegExp(
          '^(\\d{1,2})[.)]?\\s+' +           // 1: номер позиції
          '(.+?)\\s+' +                      // 2: код+назва (жадібно мінімально)
          '(\\d+(?:[.,]\\d+)?)\\s*' +        // 3: кількість
          '(?:szt|pcs|szt\\.|\\(szt\\)|j\\.m\\.)[^\\d]*' + // одиниця
          '(.+)$'                            // 4: хвіст із цінами/ставкою
        , 'i');

        for (const line of textLines) {
          const m = line.match(reLine);
          if (!m) continue;

          const qty = num(m[3]) || 1;
          let nameRaw = m[2].trim();
          const tail = m[4];

          // у хвості шукаємо ставку ПДВ і ціну нетто за одиницю
          const tailNums = tail.match(new RegExp(NUM, 'g')) || [];
          let vat = 23;
          let purchase = 0;
          for (const raw of tailNums) {
            const clean = raw.replace(/[ \u00a0]/g, '');
            // ставка ПДВ
            if (/^(0|5|8|23)$/.test(clean) && !/[.,]/.test(clean)) { vat = parseInt(clean); continue; }
            if (clean === '0,00' || clean === '0.00') continue; // rabat
            const v = num(raw);
            if (v > 0 && purchase === 0) { purchase = v; }
          }

          // відокремлюємо код від назви: артикул зазвичай містить цифри
          // і/або дефіс (P02267, ELB-D-28-095, AKC133-1, 000846)
          let code = '';
          const cm = nameRaw.match(/^([A-Za-z0-9][A-Za-z0-9\-_/]*\d[A-Za-z0-9\-_/]*)\s+(.+)$/);
          if (cm && cm[2].length > 2) { code = cm[1]; nameRaw = cm[2].trim(); }

          if (!nameRaw || purchase <= 0) continue;
          items.push({ code, name: nameRaw, qty, purchase, vat, isDelivery: DELIVERY.test(nameRaw) });
        }

        resolve({ items });
      } catch (e) {
        reject(e);
      }
    });
    parser.parseBuffer(buffer);
  });
}

// Розкидати доставку рівномірно по товарах як extra_cost на одиницю
export function distributeDelivery(items: ParsedItem[]) {
  const goods = items.filter(i => !i.isDelivery);
  const deliveryNet = items.filter(i => i.isDelivery).reduce((a, i) => a + i.purchase * i.qty, 0);
  const totalUnits = goods.reduce((a, i) => a + i.qty, 0) || 1;
  const perUnit = deliveryNet / totalUnits;
  return goods.map(i => ({
    code: i.code,
    name: i.name,
    qty: i.qty,
    purchase: Math.round(i.purchase * 100) / 100,
    extra_cost: Math.round(perUnit * 100) / 100,
    vat: i.vat,
  }));
}

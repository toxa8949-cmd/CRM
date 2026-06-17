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
        const lines = Object.keys(byY).map(Number).sort((a, b) => a - b)
          .map(y => ({ y, cells: byY[y].sort((a, b) => a.x - b.x) }));

        const items: ParsedItem[] = [];
        let pendingCode = '';

        for (let li = 0; li < lines.length; li++) {
          const cells = lines[li].cells;
          const joined = cells.map(c => c.s.trim()).join(' ');

          // рядок-товар: починається з порядкового номера 1..99
          const first = cells[0]?.s.trim();
          if (!/^\d{1,2}$/.test(first || '')) {
            // можливо це самотній EAN-код під попереднім товаром (запамʼ?ятаємо)
            if (cells.length === 1 && /^\d{8,14}$/.test(first || '') && items.length) {
              if (!items[items.length - 1].code) items[items.length - 1].code = first;
            }
            continue;
          }

          // знаходимо число кількості: токен виду "5,000" або "1 szt" або "1 szt. / pcs"
          let qtyIdx = -1, qty = 0;
          for (let i = 1; i < cells.length; i++) {
            const s = cells[i].s.trim();
            if (/\bszt|\bpcs|\bszt\./i.test(s)) { qtyIdx = i; qty = num(s) || 1; break; }
            if (/^\d+[.,]\d{3}$/.test(s)) { qtyIdx = i; qty = num(s); break; } // "5,000"
          }
          if (qtyIdx === -1) continue; // не товарний рядок

          // код: другий токен, якщо схожий на артикул І після нього лишається назва
          let code = '';
          let nameStart = 1;
          const second = cells[1]?.s.trim() || '';
          const hasMoreCols = qtyIdx > 2; // є щонайменше ще один токен між second і qty
          if (hasMoreCols && /^[0-9A-Za-z][0-9A-Za-z\-_/]{2,}$/.test(second) && !/^\d+[.,]/.test(second)) {
            code = second; nameStart = 2;
          }
          const name = cells.slice(nameStart, qtyIdx).map(c => c.s.trim()).join(' ').trim();

          // числа праворуч від кількості: [cena netto/od][?][vat][...]; беремо ціну нетто за од.
          const after = cells.slice(qtyIdx + 1).map(c => c.s.trim()).filter(Boolean);
          // шукаємо ставку VAT (ціле 0,5,8,23) щоб орієнтуватися
          let vat = 23;
          const nums = after.map(num);
          // ціна нетто за одиницю = перше число після qty, що не є ставкою vat і не нуль (rabat 0,00)
          let purchase = 0;
          for (let i = 0; i < after.length; i++) {
            const v = nums[i];
            if (/^(0|5|8|23)$/.test(after[i].replace(/\s/g, ''))) { vat = Number(after[i]); continue; }
            if (after[i] === '0,00') continue; // rabat
            if (v > 0) { purchase = v; break; }
          }

          if (!name || purchase <= 0) continue;
          items.push({ code, name, qty: qty || 1, purchase, vat, isDelivery: DELIVERY.test(name) });
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

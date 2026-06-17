import { NextRequest, NextResponse } from 'next/server';
import { parseInvoice, distributeDelivery } from '../../../lib/invoiceParser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'Файл не передано' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const { items } = await parseInvoice(buffer);
    if (!items.length) {
      return NextResponse.json({ error: 'Не вдалося розпізнати товари у фактурі. Можливо це скан (без текстового шару).' }, { status: 422 });
    }
    const goods = distributeDelivery(items);
    return NextResponse.json({ items: goods });
  } catch (e: any) {
    return NextResponse.json({ error: 'Помилка обробки PDF: ' + (e?.message || String(e)) }, { status: 500 });
  }
}

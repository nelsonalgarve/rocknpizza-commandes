import { NextRequest, NextResponse } from 'next/server';

interface WooLineItem {
  product_id: number;
  name: string;
  quantity: number;
  total: string;
  total_tax: string;
  short_description?: string;
}

interface WooOrder {
  id: number;
  status: string;
  billing: {
    first_name: string;
    last_name: string;
    phone: string;
    email: string;
  };
  line_items: WooLineItem[];
  total: string;
  [key: string]: unknown; // <== plus propre que `any`
}

interface WooProduct {
  short_description?: string;
}

export async function GET(request: NextRequest) {
  try {
    const wcBase = process.env.WOOCOMMERCE_URL!;
    const auth = {
      username: process.env.WOOCOMMERCE_CONSUMER_KEY!,
      password: process.env.WOOCOMMERCE_CONSUMER_SECRET!,
    };

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'processing,preparation,completed';
    const perPage = searchParams.get('per_page') || '20';

    const res = await fetch(`${wcBase}/wp-json/wc/v3/orders?status=${status}&per_page=${perPage}`, {
      headers: {
        Authorization:
          'Basic ' + Buffer.from(`${auth.username}:${auth.password}`).toString('base64'),
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const error = await res.text();
      console.error('Erreur WooCommerce:', res.status, error);
      return NextResponse.json({ error: 'Erreur WooCommerce' }, { status: 500 });
    }

    const orders = (await res.json()) as WooOrder[];

    const enrichedOrders: WooOrder[] = await Promise.all(
      orders.map(async (order) => {
        const itemsWithDesc: WooLineItem[] = await Promise.all(
          order.line_items.map(async (item) => {
            try {
              const productRes = await fetch(`${wcBase}/wp-json/wc/v3/products/${item.product_id}`, {
                headers: {
                  Authorization:
                    'Basic ' + Buffer.from(`${auth.username}:${auth.password}`).toString('base64'),
                  'Content-Type': 'application/json',
                },
              });

              if (!productRes.ok) return item;

              const product = (await productRes.json()) as WooProduct;
              return {
                ...item,
                short_description: product.short_description,
              };
            } catch {
              return item;
            }
          })
        );

        return {
          ...order,
          line_items: itemsWithDesc,
        };
      })
    );

    return NextResponse.json(enrichedOrders);
  } catch (err: unknown) {
    console.error('Erreur serveur GET commandes:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

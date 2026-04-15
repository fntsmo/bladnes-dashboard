import { NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase-server";
import { renderToBuffer, Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";


const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a" },
  title: { fontSize: 14, fontFamily: "Helvetica-Bold", textAlign: "center", marginBottom: 6 },
  subtitle: { fontSize: 10, textAlign: "center", marginBottom: 24, color: "#444" },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 6, borderBottom: "1px solid #ccc", paddingBottom: 3 },
  row: { flexDirection: "row", marginBottom: 4 },
  label: { width: 160, color: "#666" },
  value: { flex: 1 },
  table: { marginTop: 8 },
  tableHeader: { flexDirection: "row", backgroundColor: "#f0f0f0", padding: "6 8", fontFamily: "Helvetica-Bold" },
  tableRow: { flexDirection: "row", padding: "5 8", borderBottom: "1px solid #eee" },
  col1: { flex: 3 },
  col2: { flex: 1, textAlign: "center" },
  col3: { flex: 1, textAlign: "right" },
  col4: { flex: 1, textAlign: "right" },
  totalRow: { flexDirection: "row", padding: "6 8", backgroundColor: "#f9f9f9", fontFamily: "Helvetica-Bold" },
  footer: { marginTop: 32, borderTop: "1px solid #ccc", paddingTop: 12 },
  sigRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 24 },
  sigBlock: { width: "45%" },
  sigLabel: { color: "#666", marginBottom: 24 },
  sigLine: { borderTop: "1px solid #999", paddingTop: 4, color: "#666", fontSize: 9 },
});

function fmtMoney(n) {
  return Number(n || 0).toLocaleString("ru-RU") + " ₽";
}

function fmtDate(str) {
  if (!str) return "—";
  const d = new Date(str);
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const MY_REQUISITES = `ИП Тиханов Алексей Владимирович
ИНН: 434585270488
ОГРНИП: 320435500011870
р/с: 40802810801500018803
Банк: ВОЛГО-ВЯТСКИЙ БАНК ПАО СБЕРБАНК
БИК: 042202603
к/с: 30101810900000000603`;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const specId = searchParams.get("id");
  if (!specId) return NextResponse.json({ error: "id required" }, { status: 400 });

  // Загружаем спецификацию с договором и заказом
  const { data: spec, error } = await supabase
    .from("specifications")
    .select("*, contracts(*), spec_files(*)")
    .eq("id", specId)
    .single();

  if (error || !spec) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Загружаем заказ
  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("uid", spec.order_uid)
    .single();

  const contract = spec.contracts;
  const deliveryText = `${spec.delivery_days} рабочих дней ${spec.delivery_note || "после 100% оплаты"}`;
  const total = order?.amount || 0;

  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Заголовок */}
        <Text style={styles.title}>
          СПЕЦИФИКАЦИЯ № {spec.number} к Договору № {contract?.number || "—"} от {fmtDate(contract?.date)}
        </Text>
        <Text style={styles.subtitle}>г. Киров</Text>

        {/* Стороны */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Стороны</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Исполнитель:</Text>
            <Text style={styles.value}>ИП Тиханов Алексей Владимирович</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Заказчик:</Text>
            <Text style={styles.value}>{contract?.counterparty || "—"}</Text>
          </View>
        </View>

        {/* Таблица заказа */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Состав заказа</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.col1}>Наименование</Text>
              <Text style={styles.col2}>Кол-во</Text>
              <Text style={styles.col3}>Цена за ед.</Text>
              <Text style={styles.col4}>Сумма</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.col1}>{order?.product || "—"}</Text>
              <Text style={styles.col2}>{order?.qty || 0} шт.</Text>
              <Text style={styles.col3}>{order?.qty ? fmtMoney(order.amount / order.qty) : "—"}</Text>
              <Text style={styles.col4}>{fmtMoney(order?.amount)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.col1}>ИТОГО:</Text>
              <Text style={styles.col2}>{order?.qty || 0} шт.</Text>
              <Text style={styles.col3}></Text>
              <Text style={styles.col4}>{fmtMoney(total)}</Text>
            </View>
          </View>
        </View>

        {/* Условия */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Условия</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Срок изготовления:</Text>
            <Text style={styles.value}>{deliveryText}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Номер партии:</Text>
            <Text style={styles.value}>{order?.order_id || "—"}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Счёт №:</Text>
            <Text style={styles.value}>{order?.invoice || "—"}</Text>
          </View>
        </View>

        {/* Реквизиты */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Реквизиты Исполнителя</Text>
          <Text style={{ lineHeight: 1.5, color: "#444" }}>{MY_REQUISITES}</Text>
        </View>

        {/* Подписи */}
        <View style={styles.footer}>
          <View style={styles.sigRow}>
            <View style={styles.sigBlock}>
              <Text style={styles.sigLabel}>Исполнитель:</Text>
              <Text style={styles.sigLine}>ИП Тиханов А.В. / ________________</Text>
            </View>
            <View style={styles.sigBlock}>
              <Text style={styles.sigLabel}>Заказчик:</Text>
              <Text style={styles.sigLine}>{contract?.counterparty || "________________"} / ________________</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );

  const buffer = await renderToBuffer(doc);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="spec-${spec.number}-contract-${contract?.number || "X"}.pdf"`,
    },
  });
}

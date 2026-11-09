# นิยาม KPI และ Source Mapping

## 1. ตารางต้นทาง (ฐานข้อมูล WMS / hea_uat)

| ตาราง/view | ความหมาย | คอลัมน์ที่ใช้ | หมายเหตุ |
|---|---|---|---|
| `record_invoices` | ใบแจ้งหนี้ค่าน้ำ (BL = ระบบใหม่ ตั้งแต่ 19 มี.ค. 69; IR/IS/IN/IL/IM/INT/ISK = ระบบเดิม) | issue_date, due_date, status (paymented/pending/cancelled), sum (ค่าน้ำ), sum_service (ค่าบริการ), discount (รวม VAT), total_before_discount, vat, total, water_unit, discount_config, customer_water_id, branch_id, customer_name | `total = sum + sum_service − discount + vat` · ตัดแถวซ้ำทุกค่าด้วย `DISTINCT ON (invoice_number, customer_water_id, issue_date, total, water_unit)` |
| `record_bills` | ใบเสร็จค่าน้ำ (IV = ระบบใหม่) | record_invoice_id, payment_date, issue_date, payment_type, total, withhold_tax_amount, status, branch_id | ใช้สาขาจากใบแจ้งหนี้ · วันที่ปี พ.ศ. แปลงเป็น ค.ศ. |
| `vw_dash_bill_invoice_fees` (view ของ `bill_invoice_fees`) | ใบแจ้งหนี้งานขาย/บริการ + ใบแจ้งหนี้ค่าน้ำลูกค้ารายใหญ่ระบบเดิม (INT/IMK) | bill_date, subtotal, vat, total, status, bill_fee_id, customer_water_id, branch_id, invoice_number | bill_fee_id ว่าง = ยังไม่ชำระ |
| `bill_fees` | ใบเสร็จงานขาย/บริการ | payment_date, bill_date, payment_type, total, withhold_tax_amount, status, customer_water_id, bill_number | |
| `vw_dash_bill_payment_bonds` | ใบเสร็จเงินประกันการใช้น้ำ | payment_date, bill_date, payment_type, total, status | ไม่นับเป็นยอดขาย · ไม่มีคอลัมน์ภาษีหัก ณ ที่จ่าย |
| `vw_dash_credit_notes` | ใบลดหนี้ | issue_date, status, total, vat, amount_used_total, customer_water_id, branch_id, reason | |
| `vw_dash_customer_waters` | ทะเบียนผู้ใช้น้ำ (ตัดข้อมูลส่วนบุคคล) | id, registration_number, type_id, branch_id, dma_id, status, personal_type, created_at | |
| `customer_water_types` | ประเภทผู้ใช้น้ำ | name (ใช้ส่วนก่อน “ - ” เช่น T2.2) | |
| `branches`, `dmas` | สาขา, DMA | name | |

ลูกค้ารายใหญ่ที่บิลค่าน้ำระบบเดิมอยู่ใน `bill_invoice_fees`: customer_water_id 4 = กปภ. (AR00C-00029), 2438 = ทอท. (AR00C-02663), 1363 = อบต.ไม้ขาว/หอถัง (AR00C-02917)

## 2. ชุดข้อมูล (SQL)

| ไฟล์ | ชุดข้อมูล | มิติ | ใช้ในหน้า |
|---|---|---|---|
| 01_sales_cube.sql | ยอดขาย/หน่วยน้ำ | เดือน × สาขา × ประเภท × แหล่งเอกสาร (W/L/F/C) | ทุกหน้า |
| 02_dma_monthly.sql | ค่าน้ำตาม DMA | เดือน × DMA | ยอดขาย |
| 03_customers.sql | ลูกค้าออกบิล/ลูกค้าใหม่/สถานะทะเบียน | เดือน × สาขา × ประเภท | ภาพรวม, ลูกค้า |
| 04_top_customers.sql | 15 รายแรก 12 เดือนเต็มล่าสุด | ลูกค้า | ยอดขาย, ลูกค้า |
| 05_declines.sql | ลูกค้ายอดลด | ลูกค้า | ลูกค้า, ภาพรวม |
| 06_collections.sql | ยอดรับชำระ | เดือน × สาขา × ประเภท × ช่องทาง | ภาพรวม, จัดเก็บ |
| 07_cohort.sql | อัตราเก็บเงินรายรุ่น | เดือนออกบิล × สาขา | ภาพรวม, จัดเก็บ |
| 08_ar.sql | ลูกหนี้ตามอายุ | สาขา × ประเภท × ประเภทหนี้ × ช่วงอายุ | ภาพรวม, จัดเก็บ |
| 09_debtors.sql | ลูกหนี้เกินกำหนด 25 รายแรก + เอกสาร | ลูกค้า/เอกสาร | จัดเก็บ (drill-down) |
| 10_drill_top.sql | เอกสารของลูกค้า 15 รายแรก | เอกสาร | ยอดขาย (drill-down) |
| 11_quality.sql | ตรวจคุณภาพข้อมูล | รายการ | คุณภาพข้อมูล |
| 12_meta.sql | วันที่ข้อมูลล่าสุดในฐานข้อมูล | – | หัวหน้าจอ |

## 3. นิยาม KPI

| KPI | สูตร | แหล่ง | ฐานเวลา | ตัวกรองที่มีผล |
|---|---|---|---|---|
| ยอดขายสุทธิ (ไม่รวม VAT) | W: `sum + sum_service − discount × (sum + sum_service) / total_before_discount` + L: `subtotal` + F: `subtotal` − C: `total − vat` | record_invoices (ไม่ยกเลิก), bill_invoice_fees (active), credit_notes (ไม่ยกเลิก) | วันที่ออกเอกสาร | เดือน สาขา ประเภท |
| ค่าน้ำ / ค่าบริการ / งานขาย / ใบลดหนี้ | W.sum + L.subtotal / W.sum_service / F.subtotal / −C | ตามบรรทัดบน | วันที่ออกเอกสาร | เดือน สาขา ประเภท |
| ยอดก่อนส่วนลด, ส่วนลด | ค่าน้ำ + ค่าบริการ + งานขาย; ส่วนลดถอด VAT ตามสัดส่วน | record_invoices | วันที่ออกใบแจ้งหนี้ | เดือน สาขา ประเภท |
| ปริมาณน้ำรวม / ฟรี / คิดเงิน | Σ water_unit; Σ min(water_unit, discount_value) เมื่อ discount_type = free_units; รวม − ฟรี | record_invoices | วันที่ออกใบแจ้งหนี้ | เดือน สาขา ประเภท |
| ยอดรับชำระตามใบเสร็จ (รวม VAT) | Σ total ของใบเสร็จค่าน้ำ + งานขาย + เงินประกัน แยก 3 ประเภท | record_bills (paymented), bill_fees (active), bill_payment_bonds (ไม่ยกเลิก) | coalesce(payment_date, วันที่ใบเสร็จ) | เดือน สาขา |
| ภาษีหัก ณ ที่จ่าย | Σ withhold_tax_amount | record_bills, bill_fees | วันที่รับชำระ | เดือน สาขา |
| สัดส่วนรับชำระต่อยอดแจ้งหนี้ (ค่าน้ำ) | รับชำระค่าน้ำในช่วง ÷ (W + L) ยอดรวม VAT ในช่วง | collections ÷ sales_cube | ช่วงเดือน (คนละรุ่นเอกสาร) | เดือน สาขา |
| อัตราเก็บเงินรายรุ่น | Σ total ของใบแจ้งหนี้รุ่นเดือน X ที่ชำระแล้ว (ใบเสร็จแรก ≤ วันอ้างอิง) ÷ Σ total รุ่นเดียวกัน; ตรงเวลา = ใบเสร็จแรก ≤ due_date | record_invoices (ตั้งแต่ มี.ค. 69) + record_bills | เดือนออกบิล + วันอ้างอิง | เดือน สาขา วันอ้างอิง |
| ลูกหนี้คงค้าง | Σ total ของใบแจ้งหนี้ค่าน้ำสถานะ pending ที่ออก ≤ วันอ้างอิง + ใบแจ้งหนี้งานขาย active ที่ยังไม่มี bill_fee_id | record_invoices, bill_invoice_fees | วันอ้างอิง | สาขา ประเภท วันอ้างอิง |
| อายุหนี้ | `วันอ้างอิง − due_date`: ≤0 ยังไม่ครบกำหนด / 1–30 / 31–60 / 61–90 / >90 / ไม่มี due_date = “ไม่มีวันครบกำหนด (รอตรวจสอบ)” | record_invoices | วันอ้างอิง | สาขา ประเภท วันอ้างอิง |
| ลูกค้าที่ออกใบแจ้งหนี้ | count(distinct customer_water_id) ในเดือน | record_invoices | วันที่ออกใบแจ้งหนี้ | เดือน สาขา ประเภท |
| ลูกค้าใหม่ | ผู้ใช้น้ำที่ใบแจ้งหนี้ค่าน้ำใบแรกในประวัติอยู่ในเดือนนั้น | record_invoices | วันที่ออกใบแจ้งหนี้ | เดือน สาขา ประเภท |
| ทะเบียนใหม่ | ผู้ใช้น้ำที่ created_at อยู่ในเดือน | vw_dash_customer_waters | วันที่ลงทะเบียน | เดือน |
| การกระจุกตัว | ยอดค่าน้ำ 10/20 รายแรก ÷ ยอดค่าน้ำรวม (W + L − C, 12 เดือนเต็มล่าสุด, ไม่รวมงานขาย F) | 04_top_customers | 12 เดือนเต็มล่าสุด | ไม่มี |
| ลูกค้ายอดลด | 3 เดือนเต็มล่าสุด ≤ 70% ของช่วงเดียวกันปีก่อน และฐานปีก่อน ≥ 15,000 บาท | 05_declines | 3 เดือนเต็มล่าสุด | สาขา ประเภท |
| MoM | ช่วงที่เลือกเทียบช่วงยาวเท่ากันก่อนหน้า | – | – | – |
| YoY / YTD | ช่วงเดียวกันปีก่อน / ม.ค.–เดือนสุดท้ายที่เลือก เทียบปีก่อน · ไม่แสดงเมื่อไม่มีข้อมูลฐานหรือเดือนสุดท้ายไม่ครบ · ⚠ เมื่อช่วงใดไม่มีบิล กปภ. | – | – | – |
| เป้ายอดขาย | ไม่มีข้อมูลในระบบ → “ยังไม่กำหนดเป้า” | – | – | – |

## 4. การจัดกลุ่มที่ต้องรู้

- ประเภทลูกค้า สาขา DMA ใช้ค่าปัจจุบันในทะเบียนผู้ใช้น้ำ (ไม่ใช่ค่า ณ วันที่ออกบิล) ยกเว้นยอดขายที่ใช้ `branch_id` ของเอกสาร
- รายการที่ไม่มีประเภท/สาขา/DMA แสดงเป็น “ไม่ระบุ/รอตรวจสอบ” ไม่ตัดทิ้ง
- ในกราฟ สาขาที่ปิดแล้ว (นาเตย หล่อยูง) และ “ไม่ระบุ” รวมเป็น “อื่น ๆ (สาขาปิด/ไม่ระบุ)” ส่วนตารางและตัวกรองยังแยกตามจริง
- ยอดรับชำระตามใบเสร็จ **ยังไม่ได้กระทบยอดกับบัญชีธนาคาร** จึงไม่ใช้คำว่า “เงินสดรับจริง”

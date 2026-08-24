/**
 * The canonical instruction for turning a receipt photo into a Transcription.
 * It is the other half of the parser's contract — `prompt.test.ts` asserts that
 * a CSV shaped the way this asks for is one `parseTranscription` accepts, so
 * the two cannot drift apart.
 */
export const CSV_HEADER =
  'Categoria;Artigo;Quantidade;Preço unitário;Valor;Desconto;Valor líquido'

export const TRANSCRIPTION_PROMPT = `Transcribe this receipt photo into CSV.

Rules:
- Output only the CSV. No explanation, no code fences, no commentary.
- Separate every field with a semicolon.
- Use a comma as the decimal separator (Portuguese format): 1,15 — never 1.15
- First line, exactly:
${CSV_HEADER}
- One line per item on the receipt, in the order printed.
- Repeat identical lines as separate rows. Never merge them.
- Quantidade: a whole number for counted items (3), or three decimals for items
  sold by weight (1,532).
- Valor is the price before discount, Desconto is the discount, and
  Valor líquido is Valor minus Desconto. Use 0,00 when there is no discount.
- Categoria is the section heading printed on the receipt. Repeat it on every
  item under that heading.
- Last line, the receipt's own totals:
;TOTAL;;;<total Valor>;<total Desconto>;<total Valor líquido>

Transcribe what is printed. Do not calculate, correct or round anything — the
app checks your line items against the TOTAL row and will tell me if they
disagree.`

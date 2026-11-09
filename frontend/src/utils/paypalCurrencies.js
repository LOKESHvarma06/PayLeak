export const paypalInvoiceCurrencies = [
  ["USD", "US Dollar", 2], ["EUR", "Euro", 2], ["GBP", "British Pound", 2],
  ["AUD", "Australian Dollar", 2], ["CAD", "Canadian Dollar", 2],
  ["SGD", "Singapore Dollar", 2], ["CHF", "Swiss Franc", 2],
  ["NZD", "New Zealand Dollar", 2], ["JPY", "Japanese Yen", 0],
  ["HKD", "Hong Kong Dollar", 2], ["MXN", "Mexican Peso", 2],
  ["PHP", "Philippine Peso", 2], ["PLN", "Polish Zloty", 2],
  ["SEK", "Swedish Krona", 2], ["THB", "Thai Baht", 2],
  ["NOK", "Norwegian Krone", 2], ["DKK", "Danish Krone", 2],
  ["CZK", "Czech Koruna", 2], ["ILS", "Israeli New Shekel", 2],
  ["HUF", "Hungarian Forint", 0], ["TWD", "New Taiwan Dollar", 2],
  ["CNY", "Chinese Yuan", 2], ["MYR", "Malaysian Ringgit", 2],
  ["BRL", "Brazilian Real", 2],
].map(([code, name, fractionDigits]) => ({ code, name, fractionDigits }));

export function paypalCurrencySymbol(currency) {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency })
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value ?? currency;
  } catch {
    return currency;
  }
}

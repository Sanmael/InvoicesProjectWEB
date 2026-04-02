// User types
export interface User {
  id: string
  name: string
  email: string
  isActive: boolean
  isAdmin: boolean
  createdAt: string
}

export interface CreateUserDto {
  name: string
  email: string
  password: string
}

export interface LoginDto {
  email: string
  password: string
}

export interface LoginResponse {
  userId: string
  name: string
  email: string
  isAdmin: boolean
  token: string
}

export interface UpdateUserDto {
  name?: string
  email?: string
  currentPassword?: string
  newPassword?: string
}

// Debt types
export interface Debt {
  id: string
  description: string
  amount: number
  dueDate: string
  isPaid: boolean
  paidAt: string | null
  notes: string | null
  category: string
  isInstallment: boolean
  totalInstallments: number | null
  installmentNumber: number | null
  installmentGroupId: string | null
  createdAt: string
}

export interface CreateDebtDto {
  description: string
  amount: number
  dueDate: string
  notes?: string
  category?: string
}

export interface CreateInstallmentDebtDto {
  description: string
  totalAmount: number
  firstDueDate: string
  installments: number
  notes?: string
  category?: string
}

export interface CreateRecurringDebtDto {
  description: string
  amount: number
  recurringDay: number
  months: number
  startDate?: string
  notes?: string
  category?: string
}

export interface UpdateDebtDto {
  description?: string
  amount?: number
  dueDate?: string
  isPaid?: boolean
  notes?: string
  category?: string
}

// Receivable types
export interface Receivable {
  id: string
  description: string
  amount: number
  expectedDate: string
  isReceived: boolean
  receivedAt: string | null
  notes: string | null
  isRecurring: boolean
  recurringDay: number | null
  recurrenceGroupId: string | null
  createdAt: string
}

export interface CreateReceivableDto {
  description: string
  amount: number
  expectedDate: string
  notes?: string
}

export interface CreateRecurringReceivableDto {
  description: string
  amount: number
  recurringDay: number
  notes?: string
  months?: number
}

export interface UpdateReceivableDto {
  description?: string
  amount?: number
  expectedDate?: string
  isReceived?: boolean
  notes?: string
}

// Credit Card types
export interface CreditCard {
  id: string
  name: string
  lastFourDigits: string
  creditLimit: number | null
  closingDay: number
  dueDay: number
  isActive: boolean
  totalPending: number
  availableLimit: number | null
  createdAt: string
}

export interface CreditCardWithPurchases extends CreditCard {
  totalPending: number
  purchases: CardPurchase[]
}

export interface CreateCreditCardDto {
  name: string
  lastFourDigits: string
  creditLimit: number | null
  closingDay: number
  dueDay: number
}

export interface UpdateCreditCardDto {
  name?: string
  creditLimit?: number
  closingDay?: number
  dueDay?: number
  isActive?: boolean
}

// Card Purchase types
export interface CardPurchase {
  id: string
  creditCardId: string
  description: string
  amount: number
  purchaseDate: string
  installments: number
  currentInstallment: number
  isPaid: boolean
  notes: string | null
  category: string
  createdAt: string
}

export interface CreateCardPurchaseDto {
  creditCardId: string
  description: string
  amount: number
  purchaseDate: string
  installments: number
  notes?: string
  category?: string
}

export interface UpdateCardPurchaseDto {
  description?: string
  amount?: number
  purchaseDate?: string
  installments?: number
  isPaid?: boolean
  notes?: string
  category?: string
}

// Financial Summary
export interface FinancialSummary {
  year: number
  month: number
  totalDebts: number
  totalReceivables: number
  totalCardPurchases: number
  totalToPay: number
  balance: number
}

export interface NotificationPreference {
  id: string
  userId: string
  notifyLowBalance: boolean
  lowBalanceThreshold: number
  notifyInvoiceClosed: boolean
  daysBeforeInvoiceCloseNotification: number
  notifyCardLimitNearMax: boolean
  cardLimitWarningPercentage: number
  notifyUpcomingDebts: boolean
  daysBeforeDebtDueNotification: number
  notifyUpcomingReceivables: boolean
  daysBeforeReceivableNotification: number
  emailNotificationsEnabled: boolean
}

export interface NotificationPreferenceCreateDto {
  notifyLowBalance: boolean
  lowBalanceThreshold: number
  notifyInvoiceClosed: boolean
  daysBeforeInvoiceCloseNotification: number
  notifyCardLimitNearMax: boolean
  cardLimitWarningPercentage: number
  notifyUpcomingDebts: boolean
  daysBeforeDebtDueNotification: number
  notifyUpcomingReceivables: boolean
  daysBeforeReceivableNotification: number
  emailNotificationsEnabled: boolean
}

export interface NotificationSummary {
  totalSent: number
  totalFailed: number
  totalPending: number
  lastSentAt: string | null
}

export interface EmailNotification {
  id: string
  userId: string
  type: number
  typeName: string
  subject: string
  recipientEmail: string
  sentAt: string
  wasSent: boolean
  errorMessage: string | null
}

export interface EmailSettings {
  id: string
  smtpHost: string
  smtpPort: number
  senderEmail: string
  senderName: string
  useSsl: boolean
  isConfigured: boolean
}

export interface EmailSettingsCreateDto {
  smtpHost: string
  smtpPort: number
  senderEmail: string
  senderName: string
  password: string
  useSsl: boolean
}

export interface EmailPasswordUpdateDto {
  password: string
}

export interface EmailTestDto {
  testEmail: string
  subject?: string
  body?: string
}

export interface EmailTestResult {
  success: boolean
  message: string
}

// Chat types
export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatRequest {
  message: string
  history?: ChatMessage[]
}

export interface ChatActionResult {
  type: string
  description: string
  success: boolean
}

export interface ChatResponse {
  reply: string
  actions?: ChatActionResult[]
}

// Document Import (OCR)
export interface ExtractedItem {
  description: string
  amount: number
  date: string
  category: string | null
  type: 'debt' | 'card_purchase'
  installments: number
}

export interface DocumentExtractionResult {
  fileName: string
  documentType: string
  items: ExtractedItem[]
  summary: string | null
}

export interface ConfirmImportRequest {
  items: ExtractedItem[]
  creditCardId?: string | null
}

export interface ImportResult {
  totalItems: number
  debtsCreated: number
  cardPurchasesCreated: number
  details: string[]
}

// Bank Import (OFX/CSV)
export interface BankTransaction {
  description: string
  amount: number
  date: string
  transactionType: 'credit' | 'debit'
  category: string | null
  memo: string | null
}

export interface BankImportResult {
  fileName: string
  bankName: string | null
  accountId: string | null
  totalTransactions: number
  transactions: BankTransaction[]
}

export interface ConfirmBankImportRequest {
  transactions: BankTransaction[]
  creditCardId?: string | null
}

// Telegram
export interface TelegramLink {
  botUsername: string
  linkToken: string
}

export interface TelegramStatus {
  isLinked: boolean
  telegramUsername: string | null
  notificationsEnabled: boolean
}

// Purchase Plan types
export interface MonthProjection {
  month: string
  label: string
  receivables: number
  debts: number
  cards: number
  totalExpenses: number
  freeBalance: number
  afterSavings: number
}

export interface ScenarioMonthImpact {
  month: string
  label: string
  payment: number
  baseCardBill: number
  totalCardBill: number
  totalOutflow: number
  remainingAfterSavings: number
}

export interface PurchaseScenario {
  type: 'pix' | 'card'
  label: string
  totalCost: number
  installments: number
  installmentValue: number
  viable: boolean
  monthlyImpact: ScenarioMonthImpact[]
}

export interface PurchasePlan {
  product: string
  totalPrice: number
  pixDiscountPercent: number
  pixPrice: number
  savingsGoal: number
  startMonth: string
  monthlyProjection: MonthProjection[]
  scenarios: PurchaseScenario[]
  recommendation: string
  cardStrategy: CardStrategyResult | null
}

export interface CardStrategyResult {
  totalAvailable: number
  coversFullAmount: boolean
  bestCardName: string | null
  bestCardDaysUntilPayment: number
  cards: CardSummary[]
  strategies: CardPlanStrategy[]
  billsByCard?: CardBillProjection[]
}

export interface CardSummary {
  cardId: string
  cardName: string
  lastFourDigits: string
  creditLimit: number
  availableLimit: number
  currentAvailableLimit: number
  restoredByStartMonth: number
  closingDay: number
  dueDay: number
  daysUntilPayment: number
  afterClosing: boolean
}

export interface CardPlanStrategy {
  type: 'single' | 'split'
  label: string
  allocations: CardAllocation[]
  maxDaysUntilPayment: number
  coversFullAmount: boolean
}

export interface CardAllocation {
  cardId: string
  cardName: string
  lastFourDigits: string
  amount: number
  availableLimit: number
  daysUntilPayment: number
  dueDate: string
  explanation: string
}

export interface CardBillMonth {
  month: string
  label: string
  amount: number
}

export interface CardBillProjection {
  cardId: string
  cardName: string
  lastFourDigits: string
  months: CardBillMonth[]
}

// Savings Goal types
export interface SavingsGoal {
  id: string
  title: string
  description: string | null
  targetAmount: number
  currentAmount: number
  deadline: string | null
  category: string
  isCompleted: boolean
  completedAt: string | null
  progressPercent: number
  createdAt: string
}

export interface CreateSavingsGoalDto {
  title: string
  description?: string
  targetAmount: number
  currentAmount: number
  deadline?: string
  category?: string
}

export interface UpdateSavingsGoalDto {
  title?: string
  description?: string
  targetAmount?: number
  currentAmount?: number
  deadline?: string
  category?: string
}

// Best Card Recommendation
export interface BestCardRecommendation {
  cardId: string
  cardName: string
  lastFourDigits: string
  closingDay: number
  dueDay: number
  daysUntilPayment: number
  nextClosingDate: string
  invoiceDueDate: string
  explanation: string
}

// Anticipation Simulation
export interface AnticipationInstallment {
  installmentNumber: number
  originalValue: number
  discountedValue: number
  savings: number
}

export interface AnticipationSimulation {
  purchaseId: string
  description: string
  totalInstallments: number
  remainingInstallments: number
  installmentValue: number
  totalRemaining: number
  totalDiscounted: number
  totalSavings: number
  discountRate: number
  installments: AnticipationInstallment[]
}

// Financial Health Score
export interface FinancialScoreBreakdown {
  paymentDiscipline: number
  paymentDisciplineMax: number
  creditUtilization: number
  creditUtilizationMax: number
  savingsRate: number
  savingsRateMax: number
  goalProgress: number
  goalProgressMax: number
  financialOrganization: number
  financialOrganizationMax: number
}

export interface FinancialScore {
  totalScore: number
  classification: string
  breakdown: FinancialScoreBreakdown
  tips: string[]
}

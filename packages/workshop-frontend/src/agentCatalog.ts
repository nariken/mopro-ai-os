export const AGENT_ROLES = [
  "Executive",
  "Sales",
  "Marketing",
  "Customer Support",
  "Commerce",
  "Project Management",
  "Engineering & IT",
  "People & Operations",
] as const;

export type AgentRole = (typeof AGENT_ROLES)[number];
export type AgentCatalogStage = "ready" | "connector-needed";

export type AgentCatalogItem = {
  id: string;
  role: AgentRole;
  title: string;
  outcome: string;
  description: string;
  connections: string[];
  approval: string;
  metric: string;
  stage: AgentCatalogStage;
  prompt: string;
};

type AgentTranslation = Pick<AgentCatalogItem, "title" | "outcome" | "description" | "approval" | "metric">;

// Keep catalog copy separate from the English build specification. The English prompt remains a
// stable implementation contract, while the customer-facing catalog and generated UI are Japanese.
const JA: Record<string, AgentTranslation> = {
  "executive-daily-brief": { title: "経営デイリーブリーフ", outcome: "今日判断すべき事項・リスク・約束だけを把握する。", description: "複数の業務情報を統合し、根拠付きの短いアクション案を作成します。", approval: "外部システムを変更する操作だけ承認が必要です。", metric: "日次確認時間と対応漏れ" },
  "executive-decision-prep": { title: "意思決定準備", outcome: "曖昧な経営課題を、判断できる選択肢と推奨案に変える。", description: "選択肢、根拠、前提、リスク、やり直せる次の一手を整理します。", approval: "意思決定は利用者が行い、AIは後続作業の準備だけを行います。", metric: "意思決定までの時間" },
  "executive-weekly-review": { title: "週次経営レビュー", outcome: "進捗・差異・翌週の約束を事実に基づいて週次確認する。", description: "手作業の状況確認を減らし、業務記録から定型レビューを生成します。", approval: "レビュー公開や担当割り当てには承認が必要です。", metric: "報告作成時間と期限超過数" },
  "sales-follow-up": { title: "営業フォローアップ管理", outcome: "有望な商談の放置と、約束した次アクションの漏れを防ぐ。", description: "対応すべき商談を検出し、適切な文面とタイミングを準備します。", approval: "メッセージ送信と予定登録は毎回承認が必要です。", metric: "期限超過フォロー数と返信時間" },
  "sales-meeting-prep": { title: "商談準備ブリーフ", outcome: "顧客履歴・未解決事項・目標を把握して商談に臨む。", description: "会話、資料、予定から1ページの顧客ブリーフを作成します。", approval: "準備は読み取り専用で、外部共有には承認が必要です。", metric: "商談準備時間" },
  "sales-post-meeting": { title: "商談後処理オペレーター", outcome: "記憶が薄れる前に議事録・タスク・連絡・次回予定を完了する。", description: "商談後に必要な一連の作業をまとめて準備します。", approval: "送信・タスク作成・予定登録を一括承認します。", metric: "商談終了から後処理完了までの時間" },
  "marketing-campaign-planner": { title: "キャンペーン企画", outcome: "目的と根拠から測定可能なマーケティング計画を作る。", description: "対象、訴求、チャネル、制作物、検証方法、成功基準を定義します。", approval: "公開・広告費・外部配信には承認が必要です。", metric: "企画時間とコンバージョン率" },
  "marketing-search-growth": { title: "検索グロース戦略", outcome: "検索・AI回答・地域検索から、成約可能性の高い問い合わせを継続的に獲得する。", description: "売上目標から需要、訴求、コンテンツ、地域施策、計測を逆算し、SEO・AEO・MEOを一体運用します。", approval: "公開、プロフィール変更、口コミ返信、広告費の発生には承認が必要です。", metric: "検索経由の有効問い合わせ数と商談化率" },
  "marketing-ad-strategy": { title: "広告戦略オペレーター", outcome: "業態・職種・商材に合う広告媒体と予算配分を選び、承認後の出稿から改善まで一貫運用する。", description: "媒体適合性を判定し、広告費からCTAをレンジ推計して、クリエイティブ・出稿案・計測改善を準備します。", approval: "広告アカウント接続、予算確定、出稿、増額、停止、外部クリエイティブ公開は必ず承認します。", metric: "有効CTA単価、商談化率、広告費回収期間" },
  "marketing-content-operator": { title: "コンテンツ制作オペレーター", outcome: "承認済みの企画を、公開可能なコンテンツまで進める。", description: "根拠とブランド基準を保ちながら媒体別原稿とレビュー状況を管理します。", approval: "最終公開には必ず承認が必要です。", metric: "企画から公開可能になるまでの時間" },
  "marketing-trend-video": { title: "トレンド動画制作オペレーター", outcome: "テーマひとつから、公開判断できる縦型ショート動画を完成させる。", description: "調査、台本、絵コンテ、素材選定、字幕、音声、レンダリングを一つの制作工程として進めます。", approval: "素材の権利と最終プレビューを確認し、公開だけを承認します。", metric: "テーマ入力から初稿動画までの時間" },
  "marketing-performance-review": { title: "キャンペーン効果分析", outcome: "継続・改善・停止すべき施策と、その理由を明確にする。", description: "実績変化を説明し、範囲を限定した次の検証案を提示します。", approval: "予算やキャンペーンの変更には承認が必要です。", metric: "成果単価と分析時間" },
  "support-response": { title: "問い合わせ回答オペレーター", outcome: "正確性と人の管理を保ちながら、定型問い合わせを早く解決する。", description: "問い合わせを分類し、根拠を取得して回答案を作成します。", approval: "方針で明示的に許可されるまで、顧客向け返信は承認が必要です。", metric: "初回応答時間と解決率" },
  "support-sla-guard": { title: "SLA・エスカレーション管理", outcome: "未回答・長期化・再発する問い合わせを見逃さない。", description: "顧客影響、経過時間、悪化リスクで対応順を決めます。", approval: "エスカレーション連絡と担当割り当てには承認が必要です。", metric: "SLA違反数と再オープン数" },
  "support-voc": { title: "顧客の声分析", outcome: "繰り返す顧客課題を、製品・FAQ改善の優先順位に変える。", description: "問い合わせを分類・定量化し、すべての提案を根拠に結び付けます。", approval: "製品タスク作成と公開情報の変更には承認が必要です。", metric: "再問い合わせ率と反復課題数" },
  "commerce-sales-assistant": { title: "AI接客アシスタント", outcome: "最新の商品・在庫・規約に基づいて購入相談へ回答する。", description: "事実を作らず、商品提案と注文に関する質問へ対応します。", approval: "値引き、注文変更、例外対応には承認が必要です。", metric: "接客経由の購入率と問い合わせ削減率" },
  "commerce-returns": { title: "返品・交換オペレーター", outcome: "売上と規約を守りながら、対象となる返品を迅速に解決する。", description: "条件を確認し、交換・クレジット・返金・上申案を準備します。", approval: "返金、クレジット、例外処理には承認が必要です。", metric: "返品処理時間と維持売上" },
  "commerce-product-improvement": { title: "商品改善アナリスト", outcome: "顧客の声から商品・掲載内容・配送の改善点を発見する。", description: "レビュー、返品、検索、問い合わせの傾向を商品単位で結び付けます。", approval: "商品ページと製品の変更には承認が必要です。", metric: "対象商品の返品率と購入率" },
  "pm-request-intake": { title: "依頼受付オペレーター", outcome: "散在する依頼を、明確で担当・予定を決められる仕事に変える。", description: "範囲、緊急度、担当、依存関係、不足情報を抽出します。", approval: "タスク作成と担当割り当てには承認が必要です。", metric: "依頼から整理までの時間と担当未設定数" },
  "pm-risk-guard": { title: "進行リスク管理", outcome: "期限を過ぎる前に、停止・遅延しそうな仕事を発見する。", description: "遅延、依存関係、スコープ、判断待ちの証拠を検出します。", approval: "担当変更、期限変更、関係者への連絡には承認が必要です。", metric: "リスク発見遅れと期限超過数" },
  "pm-status-report": { title: "進捗報告作成", outcome: "個別確認なしで、根拠付きの関係者向け進捗報告を作る。", description: "完了、変更、リスク、判断事項、次の約束を要約します。", approval: "社外・経営層への配信には承認が必要です。", metric: "報告作成時間と修正率" },
  "engineering-change-digest": { title: "開発変更ダイジェスト", outcome: "全IssueやPRを読まずに、変更点・理由・必要なレビューを把握する。", description: "要件、Issue、PR、リリース影響を関連付けます。", approval: "リポジトリやIssueの変更には承認が必要です。", metric: "レビュー準備時間と影響の見落とし" },
  "engineering-incident-triage": { title: "障害一次対応オペレーター", outcome: "大量の通知から、根拠ある初動と状況報告へ進める。", description: "症状をまとめ、直近の変更を確認して安全な診断手順を準備します。", approval: "本番変更と顧客連絡には承認が必要です。", metric: "一次切り分け時間と重複通知数" },
  "engineering-release-readiness": { title: "リリース準備判定", outcome: "リリース可能か、不足する証拠は何かを明確にする。", description: "対象、テスト、レビュー、移行、切り戻し、告知を確認します。", approval: "デプロイと本番設定変更には承認が必要です。", metric: "リリース準備時間と確認漏れ" },
  "people-policy-desk": { title: "社内規程案内", outcome: "最新の規程に基づいて、定型的な社内質問へ一貫して回答する。", description: "出典付きで回答し、例外は適切な担当者へ回します。", approval: "規程の例外と従業員個別の判断には人の確認が必要です。", metric: "応答時間と同一質問の反復数" },
  "people-onboarding": { title: "入退社手続きオペレーター", outcome: "アカウント・書類・機器・連絡の全手順を期限内に完了する。", description: "職種別チェックリストを作成し、複数システムで進捗を追跡します。", approval: "アカウント、権限、従業員への連絡には承認が必要です。", metric: "手順漏れと完了までの時間" },
  "people-approval-tracker": { title: "申請・承認トラッカー", outcome: "複数システムを巡回せずに、社内申請を滞りなく進める。", description: "申請内容を確認し、承認経路へ回し、停滞案件をフォローします。", approval: "指定された承認者だけが申請を承認できます。", metric: "承認所要時間と不備申請数" },
};

function agent(
  item: Omit<AgentCatalogItem, "prompt"> & { build: string },
): AgentCatalogItem {
  const translation = JA[item.id];
  const prompt = [
    `Create an agent named "${item.title}" for the ${item.role} role.`,
    `Business outcome: ${item.outcome}`,
    `Workflow: ${item.build}`,
    `Use these connections when available: ${item.connections.join(", ")}.`,
    `Human approval boundary: ${item.approval}`,
    `Show evidence for every recommendation and track this success metric: ${item.metric}.`,
    "Build a focused operational interface, not a general dashboard. Include explicit empty, loading, error, approval, completed, and already-processed states. Never perform an external write twice.",
    translation
      ? `The customer-facing interface and all responses must be in Japanese. Use the Japanese product name "${translation.title}" and success metric "${translation.metric}".`
      : "",
  ].filter(Boolean).join("\n");
  return {
    ...item,
    ...translation,
    prompt,
  };
}

export const AGENT_CATALOG: AgentCatalogItem[] = [
  agent({
    id: "executive-daily-brief", role: "Executive", title: "Executive Daily Brief",
    outcome: "Start the day with only the decisions, risks, and commitments that need attention.",
    description: "Combines business signals into a short, evidence-backed action brief.",
    connections: ["Gmail", "Google Calendar", "Notion", "Mattermost", "Chatwork"],
    approval: "Approval is required only for actions that change an external system.",
    metric: "daily review time and missed commitments", stage: "ready",
    build: "Collect recent signals, deduplicate them, identify decisions and risks, rank by impact and urgency, and prepare the next action.",
  }),
  agent({
    id: "executive-decision-prep", role: "Executive", title: "Decision Prep",
    outcome: "Turn a loosely defined management question into a decision-ready recommendation.",
    description: "Presents options, evidence, assumptions, risks, and reversible next steps.",
    connections: ["Notion", "Google Drive", "Gmail", "Multica"],
    approval: "The user selects the decision; the agent may only prepare follow-up actions.",
    metric: "decision lead time", stage: "ready",
    build: "Gather the relevant source material, separate facts from assumptions, compare options, expose missing evidence, and draft a reversible recommendation.",
  }),
  agent({
    id: "executive-weekly-review", role: "Executive", title: "Weekly Business Review",
    outcome: "Close each week with a factual view of progress, variance, and next-week commitments.",
    description: "Produces a repeatable review from work records instead of manual status chasing.",
    connections: ["Notion", "Multica", "GitHub", "Google Calendar"],
    approval: "Publishing the review or assigning commitments requires approval.",
    metric: "report preparation time and overdue commitments", stage: "ready",
    build: "Compare planned and completed work, explain material variance with linked evidence, and propose owners and next-week commitments.",
  }),
  agent({
    id: "sales-follow-up", role: "Sales", title: "Sales Follow-up Guard",
    outcome: "Prevent qualified conversations from going quiet or missing the promised next step.",
    description: "Finds follow-up obligations and prepares the right message and timing.",
    connections: ["Gmail", "Google Calendar", "Chatwork", "Notion"],
    approval: "Every outbound message and calendar write requires approval.",
    metric: "overdue follow-ups and median response time", stage: "ready",
    build: "Inspect recent customer conversations and meetings, identify explicit or implied commitments, exclude closed or irrelevant threads, and prepare a follow-up with cited context.",
  }),
  agent({
    id: "sales-meeting-prep", role: "Sales", title: "Meeting Prep Brief",
    outcome: "Enter every customer meeting knowing the history, open questions, and desired next step.",
    description: "Builds a one-page account brief from conversations, documents, and calendar context.",
    connections: ["Gmail", "Google Calendar", "Google Drive", "Notion", "Chatwork"],
    approval: "Read-only preparation; sharing the brief externally requires approval.",
    metric: "meeting preparation time", stage: "ready",
    build: "Find the upcoming meeting, identify participants and account history, summarize agreed facts and unresolved points, and suggest an agenda and target outcome.",
  }),
  agent({
    id: "sales-post-meeting", role: "Sales", title: "Post-meeting Closer",
    outcome: "Finish meeting administration before the context is lost.",
    description: "Creates the recap, tasks, follow-up message, and next meeting proposal.",
    connections: ["Google Calendar", "Gmail", "Notion", "Multica"],
    approval: "Sending, task creation, and scheduling require approval as one review bundle.",
    metric: "time from meeting end to completed follow-up", stage: "ready",
    build: "Extract decisions, commitments, owners, dates, and open questions from meeting evidence, then prepare all required follow-up actions as a single approval package.",
  }),
  agent({
    id: "marketing-campaign-planner", role: "Marketing", title: "Campaign Planner",
    outcome: "Turn an objective and evidence into a measurable campaign plan.",
    description: "Defines audience, message, channels, assets, tests, and success criteria.",
    connections: ["Notion", "Google Drive", "Gmail"],
    approval: "Campaign publication, spend, and external distribution require approval.",
    metric: "campaign planning time and conversion rate", stage: "ready",
    build: "Use prior campaign and customer evidence to define the audience, proposition, channel plan, experiment, required assets, and measurable stop or continue rules.",
  }),
  agent({
    id: "marketing-search-growth", role: "Marketing", title: "Search Growth Strategist",
    outcome: "Generate a durable pipeline of qualified inquiries from organic search, AI answers, and local discovery.",
    description: "Plans and operates SEO, AEO, and MEO as one revenue-linked growth system.",
    connections: ["Google Search Console", "Google Business Profile", "Google Analytics", "Notion", "Ghost"],
    approval: "Publishing, profile changes, review replies, and any paid spend require approval.",
    metric: "qualified organic inquiries and inquiry-to-opportunity conversion rate", stage: "ready",
    build: "Start from the revenue target, offer, service area, and conversion assumptions. Calculate the qualified inquiries and organic visits required, explicitly labeling every estimate and unknown. Research high-intent search queries, recurring customer questions, AI-answer citation opportunities, competitor and local-map gaps, then organize them by customer problem and buying stage rather than raw search volume. Produce a 90-day strategy containing positioning, content clusters, answer-ready pages and FAQs, entity and structured-data recommendations, Google Business Profile actions when the business has a legitimate customer-facing location or service area, internal links, distribution, and measurement. Do not recommend fabricated locations, reviews, citations, or keyword stuffing. Distinguish observed data from hypotheses, cite every recommendation, and prioritize by expected business impact, confidence, effort, and time to evidence. Integrate with the Content Operator for approved drafts. On each review cycle, compare Search Console, analytics, business-profile, AI-citation, and inquiry evidence against the baseline; recommend the smallest useful continue, improve, or stop decision. Never claim causality from ranking movement alone.",
  }),
  agent({
    id: "marketing-ad-strategy", role: "Marketing", title: "Advertising Strategy Operator",
    outcome: "Select the right paid-acquisition platform and operate measurable campaigns from forecast through approved launch and optimization.",
    description: "Scores platform fit, simulates CTA ranges from spend, prepares creative and campaign drafts, and improves them from measured results.",
    connections: ["Google Ads", "Meta Ads", "LinkedIn Ads", "TikTok Ads", "Google Analytics", "Notion"],
    approval: "Account connection, budget commitment, campaign launch, spend increases, pauses, and external creative publication always require approval.",
    metric: "qualified CTA cost, CTA-to-opportunity conversion, and payback period", stage: "ready",
    build: "Collect the business model, target occupation, offer, geography, average order value or LTV, gross margin, sales cycle, capacity, target CTA, landing page, usable evidence, creative constraints, budget ceiling, and measurement readiness. Distinguish advertiser platforms such as Google Ads, Meta Ads, LinkedIn Ads, TikTok Ads, Microsoft Ads, and OpenAI-supported advertising surfaces when actually available from publisher monetization such as Google AdSense; never recommend AdSense as a customer-acquisition buying channel. Score each eligible platform using audience intent, targeting reach, creative fit, minimum viable budget, conversion latency, measurement quality, policy risk, and operating burden, and explain exclusions. Simulate impressions, clicks, CTA, qualified CTA, opportunities, sales, revenue, gross profit, CAC, and payback as pessimistic/base/optimistic ranges. Label every non-observed input as an assumption, show formulas, and run break-even sensitivity rather than promising results. Produce platform-native creative briefs and draft variants, landing-page alignment, campaign structure, exclusions, conversion events, UTM naming, experiment design, and stop/continue/scale thresholds. Research and drafting may run automatically. Connecting accounts, uploading audiences, publishing creative, launching or changing campaigns, spending money, increasing budgets, and pausing live campaigns require Human Approval with a clear diff, expected result, downside, rollback, and idempotency key. After launch, compare observed results with the forecast, separate signal from noise, detect tracking failures before optimizing, and recommend the smallest controlled change. Never use prohibited targeting, fabricated evidence, dark patterns, or unapproved API credentials.",
  }),
  agent({
    id: "marketing-content-operator", role: "Marketing", title: "Content Operator",
    outcome: "Move an approved idea through drafting, review, and publication readiness.",
    description: "Maintains evidence, brand constraints, channel variants, and review status.",
    connections: ["Notion", "Google Drive", "Gmail", "Mattermost"],
    approval: "Final publication always requires approval.",
    metric: "cycle time from idea to publishable asset", stage: "ready",
    build: "Select an approved claim, preserve source evidence, draft channel-specific variants, run quality checks, and present a publication-ready review package.",
  }),
  agent({
    id: "marketing-trend-video", role: "Marketing", title: "Trend Video Production Operator",
    outcome: "Turn one topic into a reviewable vertical short video instead of stopping at a script or storyboard.",
    description: "Runs research, scripting, shot planning, licensed asset selection, captions, narration, and local rendering as one production workflow.",
    connections: ["Notion", "Google Drive", "Local video renderer"],
    approval: "Research and draft rendering are automatic. The user must approve source rights and the final preview before any publication.",
    metric: "time from topic intake to first rendered draft", stage: "ready",
    build: "Accept a topic, target audience, platform, and desired duration, defaulting to a 30-60 second 9:16 Japanese video. Research only verifiable claims and retain source URLs. Produce a hook, narration script, shot list, and timed subtitle track. For every shot, use only user-provided media, clearly licensed stock media, or locally generated assets, and record its provenance and license status. Never download or reuse an asset when its rights are unknown. Create a low-resolution storyboard preview before rendering. After the user confirms the plan, call the local video renderer to assemble narration, footage, music, and burned-in captions into an MP4. Show real progress for research, script, assets, narration, render, and quality checks. Validate duration, aspect ratio, missing media, silent audio, subtitle overflow, and source attribution. Keep project inputs and intermediate artifacts so one section can be regenerated without restarting the whole job. Present the final video, caption copy, source list, and asset-rights manifest as one review package. Never publish automatically.",
  }),
  agent({
    id: "marketing-performance-review", role: "Marketing", title: "Campaign Performance Review",
    outcome: "Know which campaign to scale, change, or stop and why.",
    description: "Explains performance changes and proposes bounded next experiments.",
    connections: ["Google Sheets", "Notion", "Google Drive"],
    approval: "Budget or campaign changes require approval.",
    metric: "cost per qualified outcome and analysis time", stage: "ready",
    build: "Compare actual results with the campaign hypothesis and baseline, identify meaningful changes, avoid unsupported causality, and propose the smallest useful next experiment.",
  }),
  agent({
    id: "support-response", role: "Customer Support", title: "Support Response Operator",
    outcome: "Resolve routine inquiries faster without losing policy accuracy or human control.",
    description: "Classifies requests, retrieves evidence, and drafts a complete response.",
    connections: ["Gmail", "Chatwork", "Mattermost", "Notion", "Google Drive"],
    approval: "All customer-facing replies require approval until an explicit policy says otherwise.",
    metric: "first-response time and resolution rate", stage: "ready",
    build: "Classify the inquiry, retrieve the applicable customer and policy context, identify missing facts, draft a grounded response, and escalate uncertainty instead of guessing.",
  }),
  agent({
    id: "support-sla-guard", role: "Customer Support", title: "SLA & Escalation Guard",
    outcome: "Prevent unanswered, aging, or repeatedly reopened requests.",
    description: "Prioritizes the queue by customer impact, age, and escalation risk.",
    connections: ["Gmail", "Chatwork", "Mattermost", "Google Calendar"],
    approval: "Escalation messages and owner assignments require approval.",
    metric: "SLA breaches and reopened cases", stage: "ready",
    build: "Find unresolved conversations, merge duplicates, recognize resolved and no-action cases, rank true risks, and prepare an owner and escalation action.",
  }),
  agent({
    id: "support-voc", role: "Customer Support", title: "Voice of Customer Analyst",
    outcome: "Convert recurring customer friction into prioritized product and FAQ improvements.",
    description: "Clusters issues, quantifies patterns, and links every recommendation to evidence.",
    connections: ["Gmail", "Chatwork", "Mattermost", "Notion", "kintone", "Multica"],
    approval: "Creating product work or changing published guidance requires approval.",
    metric: "repeat-contact rate and recurring issue volume", stage: "ready",
    build: "Analyze recent inquiries, normalize issue themes, distinguish defects from education gaps, estimate impact, and prepare evidence-backed improvement proposals.",
  }),
  agent({
    id: "commerce-sales-assistant", role: "Commerce", title: "AI Store Associate",
    outcome: "Answer buying questions with live product, inventory, and policy context.",
    description: "Recommends suitable products and handles order questions without inventing facts.",
    connections: ["Commerce platform", "Inventory", "Customer chat", "Knowledge base"],
    approval: "Discounts, order changes, and exceptional promises require approval.",
    metric: "assisted conversion and support deflection", stage: "connector-needed",
    build: "Understand purchase intent, retrieve current catalog and policy facts, compare suitable options, disclose constraints, and escalate transactions outside policy.",
  }),
  agent({
    id: "commerce-returns", role: "Commerce", title: "Returns & Exchange Operator",
    outcome: "Resolve eligible returns quickly while protecting revenue and policy compliance.",
    description: "Checks eligibility and prepares exchange, credit, refund, or escalation paths.",
    connections: ["Commerce platform", "Order management", "Shipping", "Customer email"],
    approval: "Refunds, credits, and exceptions require approval.",
    metric: "return handling time and retained revenue", stage: "connector-needed",
    build: "Verify the order and request, apply the current policy, detect fraud or exception indicators, and prepare the best valid resolution with a full audit trail.",
  }),
  agent({
    id: "commerce-product-improvement", role: "Commerce", title: "Product Improvement Analyst",
    outcome: "Find product, listing, and fulfillment improvements hidden in customer feedback.",
    description: "Connects reviews, returns, search behavior, and support themes.",
    connections: ["Commerce platform", "Reviews", "Returns", "Analytics", "Notion"],
    approval: "Listing and product changes require approval.",
    metric: "return rate and conversion by affected product", stage: "connector-needed",
    build: "Join feedback and operational signals by product, identify recurring causes, quantify impact, and prepare a prioritized listing, product, or process change.",
  }),
  agent({
    id: "pm-request-intake", role: "Project Management", title: "Request Intake Operator",
    outcome: "Turn scattered requests into clear, owned, and schedulable work.",
    description: "Extracts scope, urgency, owner, dependencies, and missing information.",
    connections: ["Gmail", "Chatwork", "Mattermost", "Notion", "Multica"],
    approval: "Creating or assigning work requires approval.",
    metric: "request-to-triage time and unowned requests", stage: "ready",
    build: "Detect genuine requests, merge duplicates, clarify the desired outcome and constraints, propose priority and ownership, and prepare a canonical work item.",
  }),
  agent({
    id: "pm-risk-guard", role: "Project Management", title: "Delivery Risk Guard",
    outcome: "Surface blocked or slipping work before the deadline is missed.",
    description: "Finds evidence of delay, dependency, scope, and decision risk.",
    connections: ["Multica", "kintone", "GitHub", "Notion", "Mattermost", "Google Calendar"],
    approval: "Reassignment, deadline changes, and stakeholder messages require approval.",
    metric: "late discoveries and overdue milestones", stage: "ready",
    build: "Compare commitments with current evidence, identify material variance and blockers, distinguish stale metadata from real risk, and prepare the minimum intervention.",
  }),
  agent({
    id: "pm-status-report", role: "Project Management", title: "Status Report Builder",
    outcome: "Produce an evidence-backed stakeholder update without manual status chasing.",
    description: "Summarizes completed work, changes, risks, decisions, and next commitments.",
    connections: ["Multica", "GitHub", "Notion", "Mattermost"],
    approval: "External or executive distribution requires approval.",
    metric: "status preparation time and correction rate", stage: "ready",
    build: "Gather authoritative project changes, reconcile conflicting status, cite source records, and draft a concise audience-specific update.",
  }),
  agent({
    id: "engineering-change-digest", role: "Engineering & IT", title: "Engineering Change Digest",
    outcome: "Understand what changed, why, and what needs review without reading every issue and PR.",
    description: "Connects requirements, issues, pull requests, and release effects.",
    connections: ["GitHub", "Multica", "Notion", "Mattermost"],
    approval: "Repository or issue changes require approval.",
    metric: "review preparation time and missed impact", stage: "ready",
    build: "Summarize material changes, connect them to requirements and open risks, identify missing review evidence, and prepare reviewer actions.",
  }),
  agent({
    id: "engineering-incident-triage", role: "Engineering & IT", title: "Incident Triage Operator",
    outcome: "Move from alert noise to a grounded first response and stakeholder update.",
    description: "Groups symptoms, checks recent changes, and prepares safe diagnostic actions.",
    connections: ["Cloudflare", "GitHub", "Mattermost", "Notion"],
    approval: "Any production mutation or customer communication requires approval.",
    metric: "time to triage and duplicate incident noise", stage: "ready",
    build: "Correlate alerts and user reports, inspect recent changes, state known impact and uncertainty, and prepare reversible diagnostics and a status message.",
  }),
  agent({
    id: "engineering-release-readiness", role: "Engineering & IT", title: "Release Readiness Guard",
    outcome: "Know whether a release is ready and exactly what evidence is missing.",
    description: "Checks scope, tests, reviews, migrations, rollback, and communications.",
    connections: ["GitHub", "Multica", "Notion", "Cloudflare"],
    approval: "Deployment and production configuration changes require approval.",
    metric: "release preparation time and escaped readiness gaps", stage: "ready",
    build: "Evaluate release evidence against an explicit checklist, flag unknowns without guessing, and prepare a go, conditional-go, or no-go recommendation.",
  }),
  agent({
    id: "people-policy-desk", role: "People & Operations", title: "Company Policy Desk",
    outcome: "Answer routine internal questions consistently with the current policy source.",
    description: "Provides cited answers and routes exceptions to the right owner.",
    connections: ["Notion", "Google Drive", "Gmail", "Mattermost"],
    approval: "Policy exceptions and employee-specific decisions require human review.",
    metric: "response time and repeat policy questions", stage: "ready",
    build: "Identify the applicable policy version, answer only from authoritative sources, show citations, detect exceptions, and route unresolved cases.",
  }),
  agent({
    id: "people-onboarding", role: "People & Operations", title: "Onboarding & Offboarding Operator",
    outcome: "Complete every access, document, equipment, and communication step on time.",
    description: "Builds and tracks a role-specific checklist across systems.",
    connections: ["Notion", "Google Drive", "Gmail", "Google Calendar", "Mattermost"],
    approval: "Account, permission, and employee communication changes require approval.",
    metric: "missed steps and completion lead time", stage: "ready",
    build: "Generate a checklist from role and policy, find missing owners or dates, prepare messages and access requests, and maintain an auditable completion state.",
  }),
  agent({
    id: "people-approval-tracker", role: "People & Operations", title: "Approval & Request Tracker",
    outcome: "Keep internal requests moving without repeatedly checking every system.",
    description: "Validates submissions, routes approvals, and follows up on stalled requests.",
    connections: ["Gmail", "kintone", "Notion", "Mattermost", "Google Drive"],
    approval: "The designated approver remains the only party that approves the request.",
    metric: "approval cycle time and incomplete submissions", stage: "ready",
    build: "Validate required information, identify the correct approval path, package the evidence, detect stalled steps, and prepare reminders without approving on anyone's behalf.",
  }),
];

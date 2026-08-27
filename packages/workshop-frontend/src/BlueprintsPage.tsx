import { Link } from "@tanstack/react-router";
import { useKumoToastManager } from "@cloudflare/kumo";
import {
  ArrowRight,
  Blueprint as BlueprintIcon,
  BookOpen,
  Lightning,
  MagnifyingGlass,
  Plug,
  ShieldCheck,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { BlueprintPublicInfo } from "@gadgets/workshop-shared/api";
import { VendorDescription } from "@gadgets/workshop-shared/gatekeeper";
import { useAuthenticatedApi } from "./AuthContext";
import { BindingBadge, uniqueBindingBadges } from "./components/BlueprintCard";
import { BlueprintPreviewPlaceholder } from "./components/BlueprintPreviewImage";
import ViewToggle from "./components/ViewToggle";
import {
  AGENT_CATALOG,
  AGENT_ROLES,
  AgentCatalogItem,
  AgentRole,
} from "./agentCatalog";

type VendorMap = Map<string, VendorDescription>;

const ROLE_LABELS: Record<AgentRole | "All", string> = {
  All: "すべて",
  Executive: "経営",
  Sales: "営業",
  Marketing: "マーケティング",
  "Customer Support": "カスタマーサポート",
  Commerce: "EC・販売",
  "Project Management": "プロジェクト管理",
  "Engineering & IT": "開発・IT",
  "People & Operations": "人事・業務運用",
};

export default function BlueprintsPage() {
  const { authenticatedApi } = useAuthenticatedApi();
  const toasts = useKumoToastManager();
  const toastsRef = useRef(toasts);
  toastsRef.current = toasts;

  const [featuredBlueprints, setFeaturedBlueprints] = useState<BlueprintPublicInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [vendorDescriptions, setVendorDescriptions] = useState<VendorMap>(() => new Map());

  const [view, setView] = useState<"grid" | "list">(() => {
    if (typeof window === "undefined") return "grid";
    return localStorage.getItem("explore-view") === "list" ? "list" : "grid";
  });
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<AgentRole | "All">("All");

  useEffect(() => {
    localStorage.setItem("explore-view", view);
  }, [view]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      authenticatedApi.listFeaturedBlueprints(),
      authenticatedApi.listGatekeeperVendors(),
    ])
      .then(([featured, vendors]) => {
        if (cancelled) return;
        setFeaturedBlueprints(featured);
        setVendorDescriptions(
          new Map(vendors.map((vendor) => [vendor.id.toLowerCase(), vendor.description])),
        );
      })
      .catch((err) => {
        console.error("Failed to load Explore data:", err);
        toastsRef.current.add({
          title: "Failed to load featured blueprints",
          variant: "error",
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authenticatedApi]);

  const q = search.trim().toLowerCase();
  const filteredBlueprints = featuredBlueprints.filter((b) => {
    if (!q) return true;
    return (
      b.metadata.title.toLowerCase().includes(q) ||
      (b.metadata.description ?? "").toLowerCase().includes(q)
    );
  });
  const filteredAgents = AGENT_CATALOG.filter((item) => {
    if (role !== "All" && item.role !== role) return false;
    if (!q) return true;
    return [item.title, item.role, item.outcome, item.description, ...item.connections]
      .some((value) => value.toLowerCase().includes(q));
  });

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col px-3 sm:px-10">
      <header className="flex items-end justify-between gap-4 px-3 pb-4 pt-6 sm:pt-10">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-kumo-default">AIエージェントカタログ</h1>
          <p className="mt-1 text-[13px] leading-[18px] tracking-[-0.25px] text-kumo-subtle">
            今ある業務システムはそのまま。AIエージェントが横断して働き、根拠と人の管理を保ちながら仕事を完了します。
          </p>
        </div>
        <ViewToggle view={view} onChange={setView} />
      </header>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 px-3 pb-3">
        <span className="text-[12px] font-medium uppercase tracking-[0.08em] text-kumo-inactive">
          {filteredAgents.length} 商品
        </span>
        <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
          <MagnifyingGlass
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-kumo-inactive"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="仕事・成果・接続先を検索…"
            className="h-10 w-full rounded-lg border border-kumo-line bg-kumo-base pl-9 pr-4 text-[16px] text-kumo-default placeholder:text-kumo-inactive transition-[border-color,box-shadow] duration-150 ease-out focus:border-kumo-ring focus:outline-none focus:ring-[3px] focus:ring-kumo-ring/15 sm:h-9 sm:text-[13px]"
          />
        </div>
      </div>

      <div className="chat-panel min-h-0 flex-1 overflow-y-auto pb-8 pt-1">
        <div className="mb-4 flex gap-2 overflow-x-auto px-3 pb-1">
          {(["All", ...AGENT_ROLES] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setRole(item)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                role === item
                  ? "border-kumo-brand bg-kumo-brand text-white"
                  : "border-kumo-line bg-kumo-base text-kumo-subtle hover:border-kumo-fill hover:text-kumo-default"
              }`}
            >
              {ROLE_LABELS[item]}
            </button>
          ))}
        </div>

        {filteredAgents.length === 0 ? (
          <EmptySection title="該当する商品がありません" message="職種または検索条件を変更してください。" />
        ) : (
          <div className="grid grid-cols-1 gap-4 px-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredAgents.map((item) => <AgentCatalogCard key={item.id} item={item} />)}
          </div>
        )}

        <div className="mx-3 my-8 border-t border-kumo-line" />
        <div className="mb-3 flex items-end justify-between gap-4 px-3">
          <div>
            <h2 className="text-base font-semibold text-kumo-default">公開済みBlueprint</h2>
            <p className="mt-0.5 text-[12px] text-kumo-subtle">
              この環境ですぐに再利用できる、公開済みの実装です。
            </p>
          </div>
        </div>

        {loading ? (
          <LoadingSkeleton view={view} />
        ) : filteredBlueprints.length === 0 ? (
          <EmptySection
            title={
              search
                ? "No blueprints match"
                : "No featured blueprints yet"
            }
            message={
              search
                ? "Try a different search term."
                : "Featured blueprints will appear here when they’re published. You can still create blueprints from your own workspaces."
            }
          />
        ) : view === "grid" ? (
          <div className="grid grid-cols-1 gap-4 px-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredBlueprints.map((blueprint) => (
              <FeaturedBlueprintCard
                key={blueprint.id}
                blueprint={blueprint}
                vendorDescriptions={vendorDescriptions}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {filteredBlueprints.map((blueprint) => (
              <FeaturedBlueprintRow
                key={blueprint.id}
                blueprint={blueprint}
                vendorDescriptions={vendorDescriptions}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AgentCatalogCard({ item }: { item: AgentCatalogItem }) {
  return (
    <article className="flex min-h-[270px] flex-col rounded-xl border border-kumo-line bg-kumo-base p-4 transition-[border-color,box-shadow] duration-150 hover:border-kumo-fill hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-kumo-fill text-kumo-brand">
          <Lightning size={17} weight="fill" />
        </div>
        <span className="rounded-full bg-kumo-tint px-2 py-1 text-[10px] font-medium uppercase tracking-[0.06em] text-kumo-subtle">
          {ROLE_LABELS[item.role]}
        </span>
      </div>

      <h3 className="mt-3 text-[15px] font-semibold tracking-[-0.25px] text-kumo-default">
        {item.title}
      </h3>
      <p className="mt-1 text-[13px] leading-[18px] text-kumo-default">{item.outcome}</p>
      <p className="mt-2 line-clamp-2 text-[12px] leading-4 text-kumo-subtle">
        {item.description}
      </p>

      <div className="mt-3 flex items-start gap-1.5 text-[11px] leading-4 text-kumo-subtle">
        <Plug size={13} className="mt-0.5 shrink-0" />
        <span className="line-clamp-2">{item.connections.join(" · ")}</span>
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-kumo-subtle">
        <ShieldCheck size={13} className="shrink-0" />
        <span>{item.stage === "ready" ? "対応済みの接続先で利用可能" : "追加コネクターが必要"}</span>
      </div>

      <Link
        to="/"
        search={{ prompt: item.prompt, title: item.title }}
        className="group mt-auto flex items-center justify-between border-t border-kumo-line pt-3 text-[12px] font-medium text-kumo-brand"
      >
        このエージェントを構築
        <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
      </Link>
    </article>
  );
}

function BlueprintThumbnail({ blueprint }: { blueprint: BlueprintPublicInfo }) {
  return (
    <div className="relative aspect-[16/9] w-full overflow-hidden border-b border-kumo-line bg-kumo-tint">
      {blueprint.screenshotUrl ? (
        <img
          src={blueprint.screenshotUrl}
          alt={`Screenshot of ${blueprint.metadata.title}`}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <BlueprintPreviewPlaceholder id={blueprint.id} />
      )}
    </div>
  );
}

function FeaturedBlueprintCard({
  blueprint,
  vendorDescriptions,
}: {
  blueprint: BlueprintPublicInfo;
  vendorDescriptions: VendorMap;
}) {
  const badges = uniqueBindingBadges(blueprint.metadata.bindings).slice(0, 2);

  return (
    <div className="themed-card-hover-shadow press group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border border-kumo-line bg-kumo-base text-left transition-[border-color,box-shadow] duration-150 ease-out hover:border-kumo-fill">
      <Link
        to="/blueprint/$id"
        params={{ id: blueprint.id }}
        aria-label={`Open featured blueprint ${blueprint.metadata.title}`}
        className="absolute inset-0 z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kumo-brand"
      />

      <BlueprintThumbnail blueprint={blueprint} />

      <div className="flex flex-1 items-start gap-2.5 px-3 py-2.5">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-kumo-fill text-kumo-subtle">
          <BlueprintIcon size={15} weight="regular" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium leading-[18px] tracking-[-0.25px] text-kumo-default">
            {blueprint.metadata.title}
          </p>
          <p
            className={`mt-0.5 line-clamp-1 text-[12px] leading-4 tracking-[-0.2px] ${
              blueprint.metadata.description ? "text-kumo-subtle" : "italic text-kumo-inactive"
            }`}
          >
            {blueprint.metadata.description || "No description"}
          </p>
          {badges.length > 0 && (
            <div className="relative z-20 mt-2 flex flex-wrap gap-1">
              {badges.map((badge) => (
                <BindingBadge
                  key={badge.vendorKey ?? badge.type}
                  badge={badge}
                  vendorDescriptions={vendorDescriptions}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FeaturedBlueprintRow({
  blueprint,
  vendorDescriptions,
}: {
  blueprint: BlueprintPublicInfo;
  vendorDescriptions: VendorMap;
}) {
  const badges = uniqueBindingBadges(blueprint.metadata.bindings).slice(0, 3);

  return (
    <Link
      to="/blueprint/$id"
      params={{ id: blueprint.id }}
      className="group flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-colors duration-150 ease-out hover:bg-kumo-tint"
    >
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-kumo-fill text-kumo-subtle">
        <BlueprintIcon size={16} weight="regular" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium tracking-[-0.25px] text-kumo-default">
          {blueprint.metadata.title}
        </p>
        <p
          className={`mt-0.5 line-clamp-1 text-[12px] leading-4 tracking-[-0.2px] ${
            blueprint.metadata.description ? "text-kumo-subtle" : "italic text-kumo-inactive"
          }`}
        >
          {blueprint.metadata.description || "No description"}
        </p>
      </div>
      {badges.length > 0 && (
        <div className="hidden shrink-0 items-center gap-1 lg:flex">
          {badges.map((badge) => (
            <BindingBadge
              key={badge.vendorKey ?? badge.type}
              badge={badge}
              vendorDescriptions={vendorDescriptions}
            />
          ))}
        </div>
      )}
    </Link>
  );
}

function LoadingSkeleton({ view }: { view: "grid" | "list" }) {
  if (view === "list") {
    return (
      <div className="flex flex-col gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-[58px] animate-pulse rounded-lg bg-kumo-elevated" />
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 px-3 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          className="overflow-hidden rounded-xl border border-kumo-line bg-kumo-base"
        >
          <div className="aspect-[16/9] w-full animate-pulse bg-kumo-elevated" />
          <div className="flex items-start gap-2.5 px-3 py-2.5">
            <div className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-kumo-elevated" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-2.5 w-2/3 animate-pulse rounded bg-kumo-elevated" />
              <div className="h-2 w-full animate-pulse rounded bg-kumo-elevated" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptySection({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 px-3 py-20 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-kumo-fill text-kumo-subtle">
        <BookOpen size={18} />
      </div>
      <div>
        <p className="text-sm font-medium text-kumo-default">{title}</p>
        <p className="mx-auto mt-1 max-w-sm text-[13px] leading-[18px] text-kumo-subtle">
          {message}
        </p>
      </div>
    </div>
  );
}

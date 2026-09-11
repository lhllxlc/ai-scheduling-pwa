"use client";
/* eslint-disable @next/next/no-location-assign-relative-destination -- Auth transitions intentionally reload to discard all private client state. */

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DateTime } from "luxon";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Leaf,
  ListChecks,
  Plus,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  X,
} from "lucide-react";
import { DEFAULT_PREFERENCES } from "@/lib/shared/defaults";
import type {
  ApiResult,
  Preferences,
  SessionInfo,
  Task,
  TaskInput,
} from "@/lib/shared/types";
import { taskInputSchema } from "@/lib/ai/schemas";
import { resolveLocalDateTime } from "@/lib/scheduler/time";

type View = "today" | "add" | "review" | "week" | "settings" | "login";
const ZONE = "Australia/Melbourne";
const EMPTY: TaskInput = {
  title: "",
  kind: "flexible",
  durationMinutes: 60,
  priority: "medium",
  startAt: null,
  endAt: null,
  dueAt: null,
  splittable: true,
  recurrence: "none",
};
async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
  key?: string,
): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = (await response.json()) as ApiResult<T>;
  if ("error" in result)
    throw Object.assign(new Error(result.error.message), {
      status: response.status,
    });
  if (!response.ok) throw new Error("Request failed. Please try again.");
  return result.data;
}
function local(iso: string | null) {
  return iso
    ? DateTime.fromISO(iso).setZone(ZONE).toFormat("yyyy-MM-dd'T'HH:mm")
    : "";
}
function instant(value: FormDataEntryValue | null) {
  if (!value) return null;
  const resolved = resolveLocalDateTime(String(value));
  if (resolved.status !== "valid")
    throw new Error(
      "This Melbourne time is invalid or ambiguous because of daylight saving. Choose another time. / 夏令时导致时间无效或不明确，请另选时间。",
    );
  return resolved.utc;
}
function time(iso: string) {
  return DateTime.fromISO(iso).setZone(ZONE).toFormat("h:mm a");
}

export function Dayweave({ view }: { view: View }) {
  const router = useRouter();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [prefs, setPrefs] = useState(DEFAULT_PREFERENCES);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState<{
    task: TaskInput;
    key: string;
    attempted?: TaskInput;
  } | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [editing, setEditing] = useState<Task | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (editing) dialogRef.current?.showModal();
  }, [editing]);
  const zh = prefs.locale === "zh";
  const t = (en: string, cn: string) => (zh ? cn : en);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const info = await api<SessionInfo>("session");
        if (!active) return;
        setSession(info);
        if (info.user) {
          const [preferences, items] = await Promise.all([
            api<Preferences>("preferences"),
            api<Task[]>("tasks"),
          ]);
          if (active) {
            setPrefs(preferences);
            setTasks(items);
          }
        }
        if (view === "review") {
          const stored = sessionStorage.getItem("dayweave-draft");
          if (stored && active) setDraft(JSON.parse(stored));
        }
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        if (active) setBusy(false);
      }
    }
    void load();
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => {
      active = false;
    };
  }, [view]);
  useEffect(() => {
    document.documentElement.lang = zh ? "zh-CN" : "en";
  }, [zh]);
  async function run(action: () => Promise<void>) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  const nav = [
    { href: "/", key: "today", label: t("Today", "今天"), icon: Sun },
    { href: "/add", key: "add", label: t("Add Plan", "添加计划"), icon: Plus },
    {
      href: "/review",
      key: "review",
      label: t("Review", "确认"),
      icon: ListChecks,
    },
    {
      href: "/week",
      key: "week",
      label: t("Week", "本周"),
      icon: CalendarDays,
    },
    {
      href: "/settings",
      key: "settings",
      label: t("Settings", "设置"),
      icon: Settings2,
    },
  ];
  const now = DateTime.now().setZone(ZONE);
  const today = now.toISODate();
  const pending = tasks.filter((task) => task.status === "pending");
  const todayTasks = tasks
    .filter(
      (task) =>
        task.startAt &&
        DateTime.fromISO(task.startAt).setZone(ZONE).toISODate() === today,
    )
    .sort((a, b) => a.startAt!.localeCompare(b.startAt!));
  const unscheduled = pending.filter((task) => !task.startAt);
  const overdue = pending.filter(
    (task) =>
      task.dueAt && DateTime.fromISO(task.dueAt).toMillis() < now.toMillis(),
  );
  function taskCard(task: Task) {
    return (
      <article
        className={`task-card ${task.status !== "pending" ? "task-done" : ""}`}
        key={task.id}
      >
        <div className="task-time">
          {task.startAt ? (
            <>
              <strong>{time(task.startAt)}</strong>
              <span>{task.endAt && time(task.endAt)}</span>
            </>
          ) : (
            <Clock3 size={19} />
          )}
        </div>
        <div className="task-content">
          <div className="chips">
            <span className={`chip ${task.kind === "fixed" ? "sage" : "sand"}`}>
              {t(
                task.kind,
                {
                  fixed: "固定事件",
                  flexible: "弹性任务",
                  deadline: "截止任务",
                  recurring: "重复任务",
                  life: "生活安排",
                  break: "休息",
                }[task.kind],
              )}
            </span>
            <span className="subtle">
              {task.durationMinutes} {t("min", "分钟")} ·{" "}
              {t(
                task.priority,
                { high: "高优先级", medium: "中优先级", low: "低优先级" }[
                  task.priority
                ],
              )}
            </span>
          </div>
          <h3>{task.title}</h3>
          <p className="subtle">
            {task.startAt
              ? t(
                  "Time chosen by you. Fixed events stay put.",
                  "时间由你选择，固定事件不会自动移动。",
                )
              : t(
                  "Unscheduled · choose a time, or keep it in your queue.",
                  "尚未排程 · 可以选择时间或保留在待安排列表。",
                )}
          </p>
          {task.dueAt && (
            <p className="due">
              {t("Due", "截止")}{" "}
              {DateTime.fromISO(task.dueAt)
                .setZone(ZONE)
                .toFormat("ccc d MMM, h:mm a")}
            </p>
          )}
          <div className="task-actions">
            {task.status === "pending" ? (
              <>
                <button
                  disabled={saving}
                  onClick={() =>
                    void run(async () => {
                      const updated = await api<Task>(
                        `tasks/${task.id}`,
                        "PATCH",
                        { status: "completed" },
                      );
                      setTasks((items) =>
                        items.map((item) =>
                          item.id === task.id ? updated : item,
                        ),
                      );
                    })
                  }
                >
                  <Check size={14} />
                  {t("Complete", "完成")}
                </button>
                <button
                  disabled={saving}
                  onClick={() =>
                    void run(async () => {
                      const updated = await api<Task>(
                        `tasks/${task.id}`,
                        "PATCH",
                        { status: "skipped" },
                      );
                      setTasks((items) =>
                        items.map((item) =>
                          item.id === task.id ? updated : item,
                        ),
                      );
                    })
                  }
                >
                  {t("Skip", "跳过")}
                </button>
              </>
            ) : (
              <span className="subtle">
                {task.status === "completed"
                  ? t("Completed", "已完成")
                  : t("Skipped", "已跳过")}
              </span>
            )}
            <button onClick={() => setEditing(task)}>
              {t("Edit", "编辑")}
            </button>
            <button
              className="danger-text"
              disabled={saving}
              onClick={() =>
                void run(async () => {
                  await api(`tasks/${task.id}`, "DELETE");
                  setTasks((items) =>
                    items.filter((item) => item.id !== task.id),
                  );
                })
              }
            >
              {t("Delete", "删除")}
            </button>
          </div>
        </div>
      </article>
    );
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content · 跳到正文
      </a>
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="brand-icon">
            <Leaf size={23} />
          </span>
          dayweave<span className="brand-dot">.</span>
        </Link>
        <p className="brand-caption">
          {t("Make room for real life.", "为真实生活留出空间。")}
        </p>
        <nav aria-label={t("Main navigation", "主导航")}>
          {nav.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={view === item.key ? "active" : ""}
              aria-current={view === item.key ? "page" : undefined}
            >
              <item.icon size={21} />
              <span>{item.label}</span>
              {view === item.key && (
                <ChevronRight size={15} className="nav-arrow" />
              )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="tiny-label">
            {t("A LITTLE REMINDER", "温馨提示")}
          </span>
          <p>
            {t(
              "Your plan should fit your life. Leave a little breathing room.",
              "让计划适应生活，也给自己留一点喘息空间。",
            )}
          </p>
          <Leaf size={24} />
        </div>
        <div className="profile">
          <span className="avatar">
            {session?.user?.email?.slice(0, 1).toUpperCase() || "D"}
          </span>
          <div>
            <strong>
              {session?.mode === "demo"
                ? t("Local workspace", "本地工作区")
                : t("Your workspace", "你的工作区")}
            </strong>
            <small>Australia/Melbourne</small>
          </div>
        </div>
      </aside>
      <main id="main-content">
        <header className="topbar">
          <span className="mobile-brand">dayweave.</span>
          <span className="desktop-date">
            {busy
              ? "Australia / Melbourne"
              : now.setLocale(zh ? "zh" : "en").toFormat("cccc, d MMMM yyyy")}
          </span>
          <div className="topbar-right">
            <span className="status-dot" />
            {t("Phase 1 · manual planning", "第一阶段 · 手动规划")}
            <button
              className="language"
              aria-label="Change language"
              onClick={() =>
                setPrefs((p) => ({ ...p, locale: zh ? "en" : "zh" }))
              }
            >
              {zh ? "EN" : "中文"}
            </button>
          </div>
        </header>
        <div className="page-content">
          {session?.mode === "demo" && (
            <div className="demo-banner">
              {t(
                "Local demo · temporary data, no cloud account or notifications.",
                "本地演示 · 数据临时保存，无云端账号或通知。",
              )}
            </div>
          )}
          {error && (
            <div role="alert" className="alert error">
              {error}
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div role="status" className="alert success">
              {notice}
            </div>
          )}
          {busy ? (
            <div className="loading" role="status">
              <span className="spinner" />
              {t("Opening your workspace…", "正在打开工作区…")}
            </div>
          ) : !session?.user || view === "login" ? (
            <section className="auth-card">
              <span className="eyebrow">YOUR DAY, WITH INTENTION</span>
              <h1>
                {t(
                  "A little structure.\nA lot more space.",
                  "让生活更有序，\n让自己更从容。",
                )}
              </h1>
              <p>
                {t(
                  "Bring your classes, shifts and personal plans into one calm place.",
                  "将课程、轮班与个人计划，放进同一个清晰的日程。",
                )}
              </p>
              {session?.user ? (
                <>
                  <p>{session.user.email}</p>
                  <Link href="/" className="button primary">
                    {t("Go to Today", "前往今天")}
                  </Link>
                </>
              ) : session?.mode === "unconfigured" ? (
                <div className="alert">
                  {t(
                    "Cloud authentication is not configured. Set the server Supabase environment variables, or enable local demo mode for development.",
                    "尚未配置云端认证。请设置服务端 Supabase 环境变量，或在开发环境启用本地演示。",
                  )}
                </div>
              ) : (
                <>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      const data = new FormData(event.currentTarget);
                      const action =
                        (
                          event.nativeEvent as SubmitEvent
                        ).submitter?.getAttribute("value") || "login";
                      void run(async () => {
                        const info = await api<
                          SessionInfo & { message?: string }
                        >("auth", "POST", {
                          action,
                          email: data.get("email"),
                          password: data.get("password"),
                        });
                        if (info.user) {
                          window.location.href = "/";
                        } else
                          setNotice(
                            info.message ||
                              t(
                                "Check your email to confirm your account.",
                                "请查收邮件以确认账号。",
                              ),
                          );
                      });
                    }}
                  >
                    <label>
                      {t("Email", "邮箱")}
                      <input
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                      />
                    </label>
                    <label>
                      {t("Password", "密码")}
                      <input
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        minLength={8}
                        required
                      />
                    </label>
                    <div className="button-row">
                      <button
                        className="primary"
                        value="login"
                        disabled={saving}
                      >
                        {t("Sign in", "登录")}
                      </button>
                      <button value="signup" disabled={saving}>
                        {t("Create account", "注册账号")}
                      </button>
                    </div>
                  </form>
                  {session?.mode === "demo" && (
                    <button
                      className="demo-entry"
                      disabled={saving}
                      onClick={() =>
                        void run(async () => {
                          await api("auth", "POST", { action: "demo" });
                          window.location.href = "/";
                        })
                      }
                    >
                      {t("Enter local demo", "进入本地演示")}
                      <ArrowRight size={18} />
                    </button>
                  )}
                </>
              )}
            </section>
          ) : (
            <>
              {view === "today" && (
                <>
                  <div className="page-heading">
                    <div>
                      <span className="eyebrow">
                        {t("A FRESH START, EVERY DAY", "每天，重新出发")}
                      </span>
                      <h1>
                        {t("A day that works for you.", "让今天，恰到好处。")}
                      </h1>
                      <p>
                        {t(
                          "A clear plan, a steady pace, and room to breathe.",
                          "计划清晰，节奏从容，也留一点自由。",
                        )}
                      </p>
                    </div>
                    <Link href="/add" className="button primary">
                      <Plus size={18} />
                      {t("Add a plan", "添加计划")}
                    </Link>
                  </div>
                  <div className="summary-grid">
                    <div className="summary-card">
                      <span>{t("On today’s calendar", "今日已安排")}</span>
                      <strong>
                        {
                          todayTasks.filter((task) => task.status === "pending")
                            .length
                        }
                        <small>{t("plans", "项计划")}</small>
                      </strong>
                      <Sun size={24} />
                    </div>
                    <div className="summary-card">
                      <span>{t("Waiting for a time", "等待安排")}</span>
                      <strong>
                        {unscheduled.length}
                        <small>{t("tasks", "项任务")}</small>
                      </strong>
                      <Clock3 size={24} />
                    </div>
                    <div className="summary-card green">
                      <span>{t("Room to be realistic", "给现实留空间")}</span>
                      <strong>
                        {prefs.maxTaskMinutesPerDay / 60}
                        <small>
                          {t("hour daily limit", "小时每日任务上限")}
                        </small>
                      </strong>
                      <Leaf size={24} />
                    </div>
                  </div>
                  <div className="today-layout">
                    <section>
                      <div className="section-heading">
                        <h2>{t("Your timeline", "今日时间线")}</h2>
                        <span className="subtle">
                          {t("Melbourne time", "墨尔本时间")}
                        </span>
                      </div>
                      {todayTasks.length ? (
                        todayTasks.map(taskCard)
                      ) : (
                        <Empty
                          title={t("Your day is open.", "今天还没有安排。")}
                          text={t(
                            "Add a fixed event to start your timeline. Flexible tasks stay visible below until you choose a time.",
                            "添加固定事件开启时间线。弹性任务会显示在下方，等待你安排。",
                          )}
                        />
                      )}
                      <div className="section-heading queue-heading">
                        <h2>{t("Ready when you are", "待安排任务")}</h2>
                        <span className="count">{unscheduled.length}</span>
                      </div>
                      {unscheduled.length ? (
                        unscheduled.map(taskCard)
                      ) : (
                        <p className="empty-small">
                          {t(
                            "All clear. No tasks waiting for a time.",
                            "暂无等待安排的任务。",
                          )}
                        </p>
                      )}
                      <details className="archive">
                        <summary>
                          {t("All plans", "全部计划")} ({tasks.length})
                        </summary>
                        {tasks.map(taskCard)}
                      </details>
                    </section>
                    <aside className="insight-column">
                      <div className="insight-card">
                        <div className="insight-icon">
                          <Sparkles size={22} />
                        </div>
                        <h2>
                          {t("One step at a time.", "一步一步，慢慢来。")}
                        </h2>
                        <p>
                          {t(
                            "You are in control. Review every plan before it joins your day.",
                            "每项计划都会由你确认，再加入日程。",
                          )}
                        </p>
                        <div className="insight-divider" />
                        <span className="tiny-label">
                          {t("PLANNING STATUS", "规划状态")}
                        </span>
                        <p>
                          {t(
                            "Automatic scheduling and capacity checks arrive in the next phase.",
                            "自动排程与可行性检查将在下一阶段加入。",
                          )}
                        </p>
                        {overdue.length > 0 && (
                          <p className="due" role="status">
                            {overdue.length}{" "}
                            {t(
                              "unfinished tasks are past their deadline.",
                              "项未完成任务已过截止时间。",
                            )}
                          </p>
                        )}
                        <Link href="/review">
                          {t("Review your draft", "查看待确认计划")}
                          <ArrowRight size={16} />
                        </Link>
                      </div>
                      <div className="privacy-note">
                        <ShieldCheck size={20} />
                        <p>
                          {t(
                            "Private by design. No plan text is sent to AI in this version.",
                            "隐私优先。此版本不会将计划正文发送给 AI。",
                          )}
                        </p>
                      </div>
                    </aside>
                  </div>
                </>
              )}
              {view === "add" && (
                <>
                  <PageHeading
                    title={t("Make space for a plan.", "为新计划留出空间。")}
                    subtitle={t(
                      "Start with the essentials. You’ll review before saving.",
                      "先填写必要信息，保存前还有一次确认。",
                    )}
                  />
                  <div className="editor-grid">
                    <section className="panel">
                      <h2>{t("Add manually", "手动添加")}</h2>
                      <TaskForm
                        task={EMPTY}
                        zh={zh}
                        busy={saving}
                        submit={t("Review plan", "确认计划")}
                        onSave={async (task) => {
                          const next = { task, key: crypto.randomUUID() };
                          sessionStorage.setItem(
                            "dayweave-draft",
                            JSON.stringify(next),
                          );
                          router.push("/review");
                        }}
                      />
                    </section>
                    <aside>
                      <div className="panel muted-panel">
                        <Sparkles size={24} />
                        <h2>{t("Words into plans", "用一句话，整理计划")}</h2>
                        <p>
                          {t(
                            "Bilingual AI understanding is coming next. Manual entry is available now.",
                            "中英混合 AI 解析将在下一阶段提供。目前可手动添加。",
                          )}
                        </p>
                        <p className="example">
                          Wednesday 5–10pm 上班，assignment Sunday 晚上交…
                        </p>
                        <button disabled>
                          {t("AI parsing · next phase", "AI 解析 · 下一阶段")}
                        </button>
                      </div>
                      <div className="panel privacy-panel">
                        <ShieldCheck size={22} />
                        <h3>{t("AI privacy preview", "AI 隐私预览")}</h3>
                        <p>
                          {t(
                            "Data sent to the model: none. No AI request is made. Only the structured fields you confirm are saved; raw natural-language plans are not collected.",
                            "发送给模型的数据：无。不会发起 AI 请求。仅保存你确认的结构化字段，不收集原始自然语言计划。",
                          )}
                        </p>
                      </div>
                    </aside>
                  </div>
                </>
              )}
              {view === "review" && (
                <>
                  <PageHeading
                    title={t("Looks right to you?", "确认一下，是否准确？")}
                    subtitle={t(
                      "Check the details. Nothing is saved until you confirm.",
                      "检查并修改细节，确认前不会保存到日程。",
                    )}
                  />
                  {draft ? (
                    <section className="panel review-panel">
                      <div className="review-label">
                        <ShieldCheck size={18} />
                        {t(
                          "Manual draft · your confirmation required",
                          "手动草稿 · 需要你的确认",
                        )}
                      </div>
                      <TaskForm
                        task={draft.task}
                        zh={zh}
                        busy={saving}
                        submit={t("Confirm & save", "确认并保存")}
                        onSave={async (task) => {
                          await run(async () => {
                            if (
                              draft.attempted &&
                              JSON.stringify(draft.attempted) !==
                                JSON.stringify(task)
                            )
                              throw new Error(
                                t(
                                  "An earlier save may have succeeded. Retry its original details, or check Today before discarding this draft.",
                                  "先前保存可能已成功。请使用原始内容重试，或先检查今天的日程再放弃草稿。",
                                ),
                              );
                            const attempt = { ...draft, task, attempted: task };
                            setDraft(attempt);
                            sessionStorage.setItem(
                              "dayweave-draft",
                              JSON.stringify(attempt),
                            );
                            try {
                              await api<Task>("tasks", "POST", task, draft.key);
                            } catch (failure) {
                              const status = (
                                failure as Error & { status?: number }
                              ).status;
                              if (
                                status &&
                                [400, 401, 403, 422, 429].includes(status)
                              ) {
                                const retry = {
                                  task,
                                  key: crypto.randomUUID(),
                                };
                                setDraft(retry);
                                sessionStorage.setItem(
                                  "dayweave-draft",
                                  JSON.stringify(retry),
                                );
                              }
                              throw failure;
                            }
                            sessionStorage.removeItem("dayweave-draft");
                            router.push("/");
                          });
                        }}
                      />
                      <button
                        className="text-button"
                        onClick={() => {
                          sessionStorage.removeItem("dayweave-draft");
                          setDraft(null);
                        }}
                      >
                        {t("Discard draft", "放弃草稿")}
                      </button>
                    </section>
                  ) : (
                    <Empty
                      title={t(
                        "Nothing to review yet.",
                        "还没有待确认的计划。",
                      )}
                      text={t(
                        "Create a manual plan first, then confirm its details here.",
                        "先添加一项手动计划，再来这里确认。",
                      )}
                      link
                    />
                  )}
                </>
              )}
              {view === "week" && (
                <>
                  <PageHeading
                    title={t("The bigger picture.", "看看这一周。")}
                    subtitle={t(
                      "Your fixed commitments, with space between them.",
                      "固定安排清晰可见，也看见安排之间的空白。",
                    )}
                  />
                  <div className="week-grid">
                    {Array.from({ length: 7 }, (_, index) => {
                      const day = now.startOf("week").plus({ days: index });
                      const items = tasks
                        .filter(
                          (task) =>
                            task.startAt &&
                            DateTime.fromISO(task.startAt)
                              .setZone(ZONE)
                              .toISODate() === day.toISODate(),
                        )
                        .sort((a, b) => a.startAt!.localeCompare(b.startAt!));
                      return (
                        <section
                          className={`week-day ${day.toISODate() === today ? "is-today" : ""}`}
                          key={index}
                        >
                          <header>
                            <span>
                              {day.setLocale(zh ? "zh" : "en").toFormat("ccc")}
                            </span>
                            <strong>{day.day}</strong>
                          </header>
                          {items.length ? (
                            items.map((task) => (
                              <button
                                className={`week-event ${task.status !== "pending" ? "task-done" : ""}`}
                                key={task.id}
                                onClick={() => setEditing(task)}
                              >
                                <small>{time(task.startAt!)}</small>
                                <strong>{task.title}</strong>
                                <small>
                                  {task.durationMinutes} {t("min", "分钟")}
                                </small>
                              </button>
                            ))
                          ) : (
                            <p className="week-free">
                              {t("Open space", "自由时间")}
                            </p>
                          )}
                        </section>
                      );
                    })}
                  </div>
                  <section className="panel week-queue">
                    <h2>{t("Unscheduled tasks", "尚未排程")}</h2>
                    <p>
                      {t(
                        "These tasks are not hidden or automatically placed. Choose a time in Edit.",
                        "这些任务不会被隐藏或自动安排。可在编辑中选择时间。",
                      )}
                    </p>
                    {unscheduled.length ? (
                      unscheduled.map(taskCard)
                    ) : (
                      <p>{t("No unscheduled tasks.", "没有待安排任务。")}</p>
                    )}
                  </section>
                </>
              )}
              {view === "settings" && (
                <>
                  <PageHeading
                    title={t(
                      "Your rhythm, your rules.",
                      "你的节奏，你来定义。",
                    )}
                    subtitle={t(
                      "Give your plans a realistic foundation.",
                      "让计划建立在真实的生活习惯之上。",
                    )}
                  />
                  <div className="editor-grid">
                    <section className="panel">
                      <h2>{t("Daily preferences", "每日偏好")}</h2>
                      <form
                        key={JSON.stringify(prefs)}
                        onSubmit={(event) => {
                          event.preventDefault();
                          const data = new FormData(event.currentTarget);
                          void run(async () => {
                            const updated: Preferences = {
                              ...prefs,
                              locale: data.get(
                                "locale",
                              ) as Preferences["locale"],
                              wakeTime: String(data.get("wakeTime")),
                              sleepTime: String(data.get("sleepTime")),
                              mealTimes: [
                                String(data.get("breakfast")),
                                String(data.get("lunch")),
                                String(data.get("dinner")),
                              ],
                              mealDurationMinutes: Number(
                                data.get("mealDurationMinutes"),
                              ),
                              breakMinutes: Number(data.get("breakMinutes")),
                              commuteMinutes: Number(
                                data.get("commuteMinutes"),
                              ),
                              eveningCutoff: String(data.get("eveningCutoff")),
                              maxTaskMinutesPerDay: Number(
                                data.get("maxTaskMinutesPerDay"),
                              ),
                            };
                            setPrefs(
                              await api<Preferences>(
                                "preferences",
                                "PUT",
                                updated,
                              ),
                            );
                            setNotice(t("Preferences saved.", "偏好已保存。"));
                          });
                        }}
                      >
                        <div className="form-grid">
                          <label>
                            {t("Language", "语言")}
                            <select name="locale" defaultValue={prefs.locale}>
                              <option value="en">English</option>
                              <option value="zh">中文</option>
                            </select>
                          </label>
                          <label>
                            {t("Timezone", "时区")}
                            <input value="Australia/Melbourne" readOnly />
                          </label>
                          {(
                            [
                              ["wakeTime", t("Wake up", "起床")],
                              ["sleepTime", t("Sleep", "睡眠")],
                              [
                                "eveningCutoff",
                                t("Evening cutoff", "晚上安排截止"),
                              ],
                            ] as const
                          ).map(([name, label]) => (
                            <label key={name}>
                              {label}
                              <input
                                type="time"
                                name={name}
                                defaultValue={prefs[name]}
                                required
                              />
                            </label>
                          ))}
                          {(["breakfast", "lunch", "dinner"] as const).map(
                            (name, index) => (
                              <label key={name}>
                                {t(
                                  ["Breakfast", "Lunch", "Dinner"][index],
                                  ["早餐", "午餐", "晚餐"][index],
                                )}
                                <input
                                  type="time"
                                  name={name}
                                  defaultValue={prefs.mealTimes[index]}
                                  required
                                />
                              </label>
                            ),
                          )}
                          {(
                            [
                              [
                                "mealDurationMinutes",
                                t("Meal duration (min)", "每餐时长（分钟）"),
                              ],
                              [
                                "breakMinutes",
                                t("Break (min)", "休息（分钟）"),
                              ],
                              [
                                "commuteMinutes",
                                t("Commute (min)", "通勤（分钟）"),
                              ],
                              [
                                "maxTaskMinutesPerDay",
                                t(
                                  "Daily task limit (min)",
                                  "每日任务上限（分钟）",
                                ),
                              ],
                            ] as const
                          ).map(([name, label]) => (
                            <label key={name}>
                              {label}
                              <input
                                type="number"
                                name={name}
                                defaultValue={prefs[name]}
                                min={
                                  name === "maxTaskMinutesPerDay" ||
                                  name === "mealDurationMinutes"
                                    ? 5
                                    : 0
                                }
                                max={1440}
                                required
                              />
                            </label>
                          ))}
                        </div>
                        <p className="form-help">
                          {t(
                            "Melbourne daylight saving is handled automatically. Preferences are saved now; automatic scheduling will use them in the next phase.",
                            "自动处理墨尔本夏令时。偏好现已可保存，下一阶段自动排程将使用这些设置。",
                          )}
                        </p>
                        <button className="primary" disabled={saving}>
                          {t("Save preferences", "保存偏好")}
                        </button>
                      </form>
                    </section>
                    <aside>
                      <section className="panel">
                        <h2>
                          {t("Take Dayweave with you", "随时打开 Dayweave")}
                        </h2>
                        <p>
                          {t(
                            "On iPhone: open this site in Safari, tap Share, then Add to Home Screen.",
                            "在 iPhone 上：用 Safari 打开本站，点分享，再选择“添加到主屏幕”。",
                          )}
                        </p>
                        <p>
                          {t(
                            "Installation requires HTTPS. When offline, a private offline page is shown.",
                            "安装需要 HTTPS。离线时将显示不含私人信息的离线页面。",
                          )}
                        </p>
                        <button disabled>
                          {t(
                            "Push notifications · next phase",
                            "推送通知 · 下一阶段",
                          )}
                        </button>
                      </section>
                      <section className="panel account-panel">
                        <h2>{t("Your account & data", "账号与数据")}</h2>
                        <p className="account-email">{session.user.email}</p>
                        <a className="button" href="/api/export" download>
                          {t("Export my data", "导出我的数据")}
                        </a>
                        <button
                          disabled={saving}
                          onClick={() =>
                            void run(async () => {
                              await api("auth", "POST", { action: "logout" });
                              sessionStorage.removeItem("dayweave-draft");
                              window.location.href = "/login";
                            })
                          }
                        >
                          {t("Sign out", "退出登录")}
                        </button>
                        <details>
                          <summary className="danger-text">
                            {t(
                              "Delete account & all plans",
                              "删除账号与全部日程",
                            )}
                          </summary>
                          <form
                            onSubmit={(event) => {
                              event.preventDefault();
                              const data = new FormData(event.currentTarget);
                              void run(async () => {
                                await api("account", "DELETE", {
                                  confirmation: data.get("confirmation"),
                                });
                                sessionStorage.removeItem("dayweave-draft");
                                window.location.href = "/login";
                              });
                            }}
                          >
                            <p>
                              {t(
                                "This permanently deletes your account and all stored plans. Type DELETE to confirm.",
                                "此操作将永久删除账号与所有日程。输入 DELETE 确认。",
                              )}
                            </p>
                            <label>
                              {t("Confirmation", "确认文字")}
                              <input
                                name="confirmation"
                                pattern="DELETE"
                                required
                                placeholder="DELETE"
                              />
                            </label>
                            <button className="danger" disabled={saving}>
                              {t("Permanently delete", "永久删除")}
                            </button>
                          </form>
                        </details>
                      </section>
                    </aside>
                  </div>
                </>
              )}
            </>
          )}
          <footer className="page-footer">
            dayweave · {t("A little more balance.", "生活，多一点平衡。")}
          </footer>
        </div>
      </main>
      {editing && (
        <dialog
          ref={dialogRef}
          onCancel={() => setEditing(null)}
          aria-labelledby="edit-title"
          className="modal"
        >
          <button
            className="close-button"
            aria-label="Close editor"
            onClick={() => setEditing(null)}
          >
            <X size={20} />
          </button>
          <h2 id="edit-title">{t("Edit plan", "编辑计划")}</h2>
          <TaskForm
            task={editing}
            zh={zh}
            busy={saving}
            submit={t("Save changes", "保存修改")}
            onSave={async (task) => {
              await run(async () => {
                const updated = await api<Task>(
                  `tasks/${editing.id}`,
                  "PATCH",
                  task,
                );
                setTasks((items) =>
                  items.map((item) =>
                    item.id === editing.id ? updated : item,
                  ),
                );
                setEditing(null);
              });
            }}
          />
        </dialog>
      )}
    </div>
  );
}
function PageHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">DAYWEAVE / YOUR SPACE</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}
function Empty({
  title,
  text,
  link,
}: {
  title: string;
  text: string;
  link?: boolean;
}) {
  return (
    <div className="empty-state">
      <CalendarDays size={30} />
      <h3>{title}</h3>
      <p>{text}</p>
      {link && (
        <Link className="button" href="/add">
          Add Plan · 添加计划 <ArrowRight size={16} />
        </Link>
      )}
    </div>
  );
}

function TaskForm({
  task,
  zh,
  busy,
  submit,
  onSave,
}: {
  task: TaskInput;
  zh: boolean;
  busy: boolean;
  submit: string;
  onSave: (task: TaskInput) => Promise<void>;
}) {
  const [kind, setKind] = useState(task.kind);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const t = (en: string, cn: string) => (zh ? cn : en);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const data = new FormData(event.currentTarget);
      const startAt = instant(data.get("startAt"));
      const endAt = instant(data.get("endAt"));
      const dueAt = instant(data.get("dueAt"));
      if ((startAt && !endAt) || (!startAt && endAt))
        throw new Error(
          t("Choose both a start and end time.", "请同时填写开始和结束时间。"),
        );
      if (startAt && endAt && startAt >= endAt)
        throw new Error(
          t("End time must be after start time.", "结束时间必须晚于开始时间。"),
        );
      const next: TaskInput = {
        title: String(data.get("title")).trim(),
        kind,
        durationMinutes: Number(data.get("durationMinutes")),
        priority: data.get("priority") as TaskInput["priority"],
        startAt,
        endAt,
        dueAt,
        splittable: data.get("splittable") === "on" && kind !== "fixed",
        recurrence: data.get("recurrence") as TaskInput["recurrence"],
      };
      await onSave(taskInputSchema.parse(next));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <form onSubmit={save}>
      {error && (
        <div role="alert" className="alert error">
          {error}
        </div>
      )}
      <label>
        {t("Plan title", "计划标题")}
        <input
          autoFocus
          name="title"
          defaultValue={task.title}
          placeholder={t(
            "e.g. Finish assignment outline",
            "例如：完成作业大纲",
          )}
          maxLength={200}
          required
        />
      </label>
      <div className="form-grid">
        <label>
          {t("Type", "类型")}
          <select
            name="kind"
            value={kind}
            onChange={(event) =>
              setKind(event.target.value as TaskInput["kind"])
            }
          >
            {(
              [
                "flexible",
                "fixed",
                "deadline",
                "recurring",
                "life",
                "break",
              ] as const
            ).map((value) => (
              <option key={value} value={value}>
                {t(
                  {
                    flexible: "Flexible task",
                    fixed: "Fixed event",
                    deadline: "Deadline task",
                    recurring: "Recurring task",
                    life: "Life plan",
                    break: "Break",
                  }[value],
                  {
                    flexible: "弹性任务",
                    fixed: "固定事件",
                    deadline: "截止任务",
                    recurring: "重复任务",
                    life: "生活安排",
                    break: "休息",
                  }[value],
                )}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("Priority", "优先级")}
          <select name="priority" defaultValue={task.priority}>
            <option value="low">{t("Low", "低")}</option>
            <option value="medium">{t("Medium", "中")}</option>
            <option value="high">{t("High", "高")}</option>
          </select>
        </label>
        <label>
          {t("Duration (minutes)", "时长（分钟）")}
          <input
            name="durationMinutes"
            type="number"
            min={5}
            max={1440}
            defaultValue={task.durationMinutes}
            required
          />
        </label>
        <label>
          {t("Repeat", "重复")}
          <select name="recurrence" defaultValue={task.recurrence}>
            <option value="none">{t("Does not repeat", "不重复")}</option>
            <option value="daily">{t("Daily", "每天")}</option>
            <option value="weekly">{t("Weekly", "每周")}</option>
          </select>
        </label>
        <label>
          {t("Start · Melbourne", "开始 · 墨尔本")}
          <input
            type="datetime-local"
            name="startAt"
            defaultValue={local(task.startAt)}
            required={kind === "fixed"}
          />
        </label>
        <label>
          {t("End · Melbourne", "结束 · 墨尔本")}
          <input
            type="datetime-local"
            name="endAt"
            defaultValue={local(task.endAt)}
            required={kind === "fixed"}
          />
        </label>
        <label className="full-width">
          {t("Deadline · optional, Melbourne", "截止 · 可选，墨尔本")}
          <input
            type="datetime-local"
            name="dueAt"
            defaultValue={local(task.dueAt)}
            required={kind === "deadline"}
          />
        </label>
      </div>
      <label className="checkbox">
        <input
          name="splittable"
          type="checkbox"
          defaultChecked={task.splittable}
          disabled={kind === "fixed"}
        />
        {t(
          "Allow splitting into smaller sessions later",
          "允许未来拆分为较小任务段",
        )}
      </label>
      <p className="form-help">
        {t(
          "Fixed events need exact times. Without times, tasks stay unscheduled. Repeat is stored as intent; repeat occurrences and automatic scheduling are not generated in this phase.",
          "固定事件需要明确时间。未填写时间的任务保持待安排状态。重复规则仅保存为意图，此阶段不会生成重复事件或自动排程。",
        )}
      </p>
      <button className="primary" disabled={busy || submitting}>
        {busy || submitting ? t("Saving…", "保存中…") : submit}
        <ArrowRight size={17} />
      </button>
    </form>
  );
}

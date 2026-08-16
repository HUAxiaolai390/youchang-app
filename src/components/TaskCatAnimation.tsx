import { useState } from "react";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";

type TaskCatAnimationProps = {
  taskKey: string;
  title: string;
  categoryId?: string;
  categoryName?: string;
  completed?: boolean;
  className?: string;
  variant?: string;
};

export type TaskCatDescriptor = Pick<TaskCatAnimationProps, "taskKey" | "title" | "categoryId" | "categoryName">;

const allTaskCatVariants = [
  "02", "03", "04", "05", "06", "08", "09", "10", "11",
  "12", "13", "14", "15", "16", "17", "18", "19", "20"
] as const;

const categoryVariantPools: Record<string, readonly string[]> = {
  study: ["02", "11", "20", "16"],
  work: ["11", "20", "02", "09"],
  exercise: ["18", "14", "10", "08", "06"],
  rest: ["05", "04", "15", "17", "03"],
  life: ["12", "03", "09", "13", "16", "17"],
  other: ["19", "06", "10", "16"]
};

const titleVariantRules: ReadonlyArray<{ pattern: RegExp; variants: readonly string[] }> = [
  { pattern: /乒乓|羽毛球|网球|球拍/u, variants: ["14"] },
  { pattern: /洗澡|洗头|淋浴/u, variants: ["12"] },
  { pattern: /拍照|摄影|相机/u, variants: ["09"] },
  { pattern: /睡觉|睡眠|午休|小憩/u, variants: ["05"] },
  { pattern: /跑步|跑操|马拉松|步行|走路|跳绳|健身|锻炼|运动|骑行|游泳|瑜伽/u, variants: ["18", "10", "08", "06"] },
  { pattern: /电脑|代码|编程|论文|作业|学习|复习|数学|英语|单词|阅读|考试|考研|课程|工作|会议|项目|邮件/u, variants: ["02", "11", "20"] },
  { pattern: /休息|冥想|放松|电影|追剧|游戏|刷视频/u, variants: ["04", "15", "17", "03"] },
  { pattern: /吃饭|早餐|午餐|晚餐|做饭|冰淇淋|甜品/u, variants: ["03", "13"] },
  { pattern: /打扫|整理|清洁|洗衣/u, variants: ["12", "16"] }
];

function stableIndex(value: string, length: number): number {
  let hash = 0;
  for (const character of value) hash = (hash * 31 + character.codePointAt(0)!) >>> 0;
  return hash % length;
}

function normalizeCategory(categoryId?: string, categoryName?: string): string {
  const key = `${categoryId ?? ""} ${categoryName ?? ""}`.toLowerCase();
  if (/学习|study/u.test(key)) return "study";
  if (/工作|work/u.test(key)) return "work";
  if (/运动|exercise|sport/u.test(key)) return "exercise";
  if (/休息|rest/u.test(key)) return "rest";
  if (/生活|life/u.test(key)) return "life";
  return "other";
}

function rotateVariants(variants: readonly string[], seed: string): string[] {
  const start = stableIndex(seed, variants.length);
  return [...variants.slice(start), ...variants.slice(0, start)];
}

function getOrderedTaskCatVariants({ taskKey, title, categoryId, categoryName }: TaskCatDescriptor): string[] {
  const matchedRule = titleVariantRules.find((rule) => rule.pattern.test(title));
  const categoryVariants = categoryVariantPools[normalizeCategory(categoryId, categoryName)];
  const seed = `${taskKey}|${title}`;
  const ordered = [
    ...(matchedRule ? rotateVariants(matchedRule.variants, seed) : []),
    ...rotateVariants(categoryVariants, `${seed}|category`),
    ...rotateVariants(allTaskCatVariants, `${seed}|all`)
  ];
  return [...new Set(ordered)];
}

export function getTaskCatVariant({
  taskKey,
  title,
  categoryId,
  categoryName
}: TaskCatDescriptor): string {
  return getOrderedTaskCatVariants({ taskKey, title, categoryId, categoryName })[0];
}

export function assignTaskCatVariants(tasks: readonly TaskCatDescriptor[]): string[] {
  const usedVariants = new Set<string>();
  return tasks.map((task) => {
    const candidates = getOrderedTaskCatVariants(task);
    const variant = candidates.find((candidate) => !usedVariants.has(candidate)) ?? candidates[0];
    usedVariants.add(variant);
    return variant;
  });
}

export function TaskCatAnimation({
  taskKey,
  title,
  categoryId,
  categoryName,
  completed = false,
  className,
  variant
}: TaskCatAnimationProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const selectedVariant = variant ?? getTaskCatVariant({ taskKey, title, categoryId, categoryName });
  const extension = prefersReducedMotion ? "png" : "gif";
  const desiredSource = `/mascot/idle/${selectedVariant}.${extension}`;
  const fallbackSource = `/mascot/idle.${extension}`;
  const [failedSources, setFailedSources] = useState<ReadonlySet<string>>(() => new Set());
  const displayedSource = failedSources.has(desiredSource) ? fallbackSource : desiredSource;

  return (
    <span
      className={["task-cat-animation", completed ? "task-cat-animation--completed" : "", className ?? ""].filter(Boolean).join(" ")}
      aria-hidden="true"
      data-task-cat-variant={selectedVariant}
    >
      <img
        src={displayedSource}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => {
          if (displayedSource === fallbackSource) return;
          setFailedSources((current) => {
            if (current.has(desiredSource)) return current;
            const next = new Set(current);
            next.add(desiredSource);
            return next;
          });
        }}
      />
    </span>
  );
}

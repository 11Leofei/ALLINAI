import notifier from "node-notifier";
import path from "path";

const APP_NAME = "ALLINAI";

export function sendNotification(title: string, message: string, url?: string) {
  notifier.notify(
    {
      title: `${APP_NAME} - ${title}`,
      message,
      sound: true,
      wait: false,
      timeout: 10,
      open: url || undefined,
    },
    (err) => {
      if (err) console.error("[ALLINAI Notifier]", err);
    }
  );
}

export function notifyMorningCommitment(pendingCount: number) {
  sendNotification(
    "开始新的一天",
    pendingCount > 0
      ? `你有 ${pendingCount} 个活跃项目。今天打算推进哪个？`
      : "创建你的第一个项目，开始行动吧！",
    "http://localhost:3000"
  );
}

export function notifyEveningCheckIn(
  totalCommitments: number,
  completedCount: number
) {
  if (totalCommitments === 0) {
    sendNotification(
      "今日回顾",
      "今天没有设定承诺。明天试试给自己定个目标？",
      "http://localhost:3000"
    );
    return;
  }

  const rate = Math.round((completedCount / totalCommitments) * 100);
  if (rate === 100) {
    sendNotification(
      "今日完成！",
      `太棒了！今天的 ${totalCommitments} 个承诺全部完成。`,
      "http://localhost:3000"
    );
  } else if (rate >= 50) {
    sendNotification(
      "今日回顾",
      `完成了 ${completedCount}/${totalCommitments} 个承诺 (${rate}%)，继续加油！`,
      "http://localhost:3000"
    );
  } else {
    sendNotification(
      "今日回顾",
      `只完成了 ${completedCount}/${totalCommitments} 个承诺 (${rate}%)。明天要更专注！`,
      "http://localhost:3000"
    );
  }
}

export function notifyStaleProject(projectName: string, days: number, stage: string) {
  sendNotification(
    "项目停滞提醒",
    `「${projectName}」已在「${stage}」停滞 ${days} 天。花 15 分钟推进一下？`,
    "http://localhost:3000"
  );
}

export function notifyGitScanComplete(scannedCount: number, activeCount: number) {
  if (scannedCount === 0) return;
  sendNotification(
    "Git 扫描完成",
    `已扫描 ${scannedCount} 个项目，动量已根据实际代码活动更新。`,
    "http://localhost:3000"
  );
}

export function notifyMomentumDrop(projectName: string, momentum: number) {
  sendNotification(
    "动量预警",
    `「${projectName}」动量降至 ${Math.round(momentum)}，需要采取行动！`,
    "http://localhost:3000"
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "增肌教练工作台",
  description: "把训练计划、逐组记录、恢复状态与14天趋势集中在一个本地优先的工作台。",
  openGraph: { title:"增肌教练工作台", description:"训练 · 恢复 · 渐进", type:"website" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}

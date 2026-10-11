import { redirect } from 'next/navigation';
/** 根路径跳授权（S1闭环起点） */
export default function Home() {
  redirect('/auth');
}

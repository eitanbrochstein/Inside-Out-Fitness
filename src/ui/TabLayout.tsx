import { Outlet } from 'react-router'
import { TabBar } from './TabBar'

export function TabLayout() {
  return (
    <>
      <Outlet />
      <TabBar />
    </>
  )
}

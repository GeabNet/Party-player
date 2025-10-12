import React from 'react'
import TopBar from './TopBar'
import SideNav from './SideNav'

export default function Layout({ children, right }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-gray-100">
      <TopBar />
      <div className="app-container flex py-6 gap-6">
        <SideNav />
        <main className="flex-1">{children}</main>
        <aside className="w-80">{right}</aside>
      </div>
    </div>
  )
}

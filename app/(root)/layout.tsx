import { ReactNode } from 'react'
import Header from "@/components/Header";

type LayoutProps = {
    children: ReactNode
}

const Layout = ({ children }: LayoutProps) => {
    return (
        <main className="min-h-screen text-gray-400">
             <Header />
            <div className="container py-10">
                {children}
            </div>
        </main>
    )
}

export default Layout


"use client"

import { BookCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <BookCheck className="h-6 w-6 text-primary" />
            <span className="font-bold">EscopoV3</span>
          </Link>
          <div className="flex flex-1 items-center justify-end space-x-4">
            <nav className="flex items-center space-x-2">
              <Button asChild variant="ghost">
                <Link href="/login">Fazer Login</Link>
              </Button>
              <Button asChild>
                <Link href="/register">Criar Conta</Link>
              </Button>
            </nav>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <div className="relative isolate">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80"
          >
            <div
              style={{
                clipPath:
                  "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)",
              }}
              className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-primary to-orange-400 opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
            />
          </div>

          <div className="py-24 sm:py-32">
            <div className="container mx-auto px-6 lg:px-8">
              <div className="mx-auto max-w-2xl text-center">
                <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
                  A gestão contábil que sua empresa merece.
                </h1>
                <p className="mt-6 text-lg leading-8 text-muted-foreground">
                  Simplifique suas rotinas fiscais, de pessoal e contábeis com uma plataforma completa, inteligente e fácil de usar.
                </p>
                <div className="mt-10 flex items-center justify-center gap-x-6">
                  <Button asChild size="lg">
                    <Link href="/register">Comece agora gratuitamente</Link>
                  </Button>
                   <Button asChild variant="ghost" size="lg">
                    <Link href="/login">Já tenho uma conta <span aria-hidden="true">→</span></Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
          
           <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-[calc(100%-13rem)] -z-10 transform-gpu overflow-hidden blur-3xl sm:top-[calc(100%-30rem)]"
           >
            <div
              style={{
                clipPath:
                  "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)",
              }}
              className="relative left-[calc(50%+3rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 bg-gradient-to-tr from-primary to-orange-400 opacity-30 sm:left-[calc(50%+36rem)] sm:w-[72.1875rem]"
            />
          </div>

        </div>
      </main>
      <footer className="border-t">
        <div className="container mx-auto py-6 px-4 text-center text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} EscopoV3. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  )
}

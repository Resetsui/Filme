import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Ocorreu um erro inesperado.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App ErrorBoundary:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#F4EAE4] px-4 text-[#2D1E25] dark:bg-[#09090B] dark:text-zinc-100">
          <div className="w-full max-w-md rounded-2xl border border-[#DFCBC1] bg-[#FAF3EE] p-6 text-center space-y-4 shadow-lg dark:border-zinc-800 dark:bg-[#111115]">
            <h1 className="font-display text-2xl font-semibold text-[#2D1E25] dark:text-zinc-50">
              Algo saiu do esperado
            </h1>
            <p className="text-sm text-[#6E5660] dark:text-zinc-400">
              Seus filmes salvos continuam protegidos. Recarregue a página para continuar sua
              curadoria.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-[#BE3A5E] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#A62E4F] dark:bg-rose-600 dark:hover:bg-rose-500 transition-colors"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Recarregar aplicativo
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

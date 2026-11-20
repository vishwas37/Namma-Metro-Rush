import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  public state: ErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Unexpected rendering error.',
    };
  }

  public componentDidCatch(error: Error): void {
    // Keep error handling graceful without unhandled crashes
    if (import.meta.env.DEV) {
      console.error('Namma Runner ErrorBoundary caught:', error);
    }
  }

  public render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-[#1A1423] text-white p-6">
          <div className="w-full max-w-md rounded-2xl bg-[#241B35] border-4 border-[#1A1423] p-6 text-center shadow-[0_10px_0_#0E0A16]">
            <h1 className="font-display text-2xl text-[#FFD60A] mb-2">
              METRO SIGNAL GLITCH!
            </h1>
            <p className="text-sm text-white/80 mb-5 leading-relaxed">
              Swalpa adjust maadi — the 3D track hit an unexpected hiccup.
              {this.state.message ? ` (${this.state.message})` : ''}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full min-h-[48px] rounded-xl bg-[#2DC653] text-[#1A1423] font-display text-lg tracking-wide border-[3px] border-[#1A1423] shadow-[0_4px_0_#1A1423] active:translate-y-0.5 cursor-pointer"
            >
              RELOAD TRACK
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: (props: { error: Error; resetError: () => void }) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(_error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary]', errorInfo.componentStack);
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const Fallback = this.props.fallback;
      if (Fallback) {
        return Fallback({ error: this.state.error!, resetError: this.resetError });
      }
      return (
        <div
          style={{
            padding: 24,
            textAlign: 'center',
            color: '#dc2626',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <h2>Произошла ошибка</h2>
          <p>{this.state.error?.message ?? 'Неизвестная ошибка'}</p>
          <button
            onClick={this.resetError}
            style={{
              marginTop: 12,
              padding: '8px 16px',
              background: '#007aff',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            Попробовать ещё раз
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

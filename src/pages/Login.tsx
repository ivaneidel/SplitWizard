import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useT } from '../i18n'

export function Login() {
  const { user, loading, signIn } = useAuth()
  const { t } = useT()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && user) navigate('/', { replace: true })
  }, [user, loading, navigate])

  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 px-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-indigo-600">SplitWizard</h1>
        <p className="mt-2 text-slate-500">{t('login.tagline')}</p>
      </div>
      <button
        type="button"
        onClick={() => void signIn()}
        className="flex items-center gap-3 rounded-lg border border-slate-300 bg-white px-6 py-3 font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
      >
        <img
          src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
          alt=""
          className="h-5 w-5"
        />
        {t('login.continueGoogle')}
      </button>
    </div>
  )
}

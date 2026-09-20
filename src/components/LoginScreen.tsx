import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Mail, 
  Lock, 
  LogIn, 
  AlertTriangle, 
  Eye, 
  EyeOff, 
  CheckCircle2,
  X,
  KeyRound
} from 'lucide-react';
import { UserSession } from '../types';
import { isValidEmail } from '../utils';
import { authService } from '../services/authService';

interface LoginScreenProps {
  currentUser?: UserSession | null;
  onBack: () => void;
  onNavigateToRegister: () => void;
  onLoginSuccess: (user: UserSession) => void;
  onShowToast: (text: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  currentUser,
  onBack: _onBack,
  onNavigateToRegister,
  onLoginSuccess,
  onShowToast,
}) => {
  const navigate = useNavigate();

  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === 'artisan') {
        navigate('/artisan', { replace: true });
      } else {
        navigate('/search', { replace: true });
      }
    }
  }, [currentUser, navigate]);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [error, setError] = useState('');
  const [loginEmailError, setLoginEmailError] = useState('');
  const [loginPasswordError, setLoginPasswordError] = useState('');
  const [loginEmailTouched, setLoginEmailTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);

  if (currentUser) {
    return null;
  }

  // Helper for email format validation
  const validateEmailFormat = (val: string): string => {
    const trimmed = val.trim();
    if (!trimmed) {
      return 'يرجى إدخال البريد الإلكتروني.';
    }
    if (!isValidEmail(trimmed)) {
      return 'يرجى إدخال بريد إلكتروني صحيح (مثال: name@domain.com).';
    }
    return '';
  };

  const handleLoginEmailBlur = () => {
    setLoginEmailTouched(true);
    setLoginEmailError(validateEmailFormat(loginEmail));
  };

  const handleLoginEmailChange = (val: string) => {
    setLoginEmail(val);
    if (loginEmailError) {
      setLoginEmailError('');
    }
    if (error) {
      setError('');
    }
    if (loginEmailTouched) {
      setLoginEmailError(validateEmailFormat(val));
    }
  };

  const handleLoginPasswordChange = (val: string) => {
    setLoginPassword(val);
    if (loginPasswordError) {
      setLoginPasswordError('');
    }
    if (error) {
      setError('');
    }
  };

  // Handle Login Submission
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    let hasErrors = false;
    let firstErrorElementId: string | null = null;

    // 1. Email validation
    const cleanEmail = loginEmail.trim();
    setLoginEmailTouched(true);
    const loginEmailErr = validateEmailFormat(cleanEmail);
    if (loginEmailErr) {
      setLoginEmailError(loginEmailErr);
      hasErrors = true;
      if (!firstErrorElementId) firstErrorElementId = 'field-login-email';
    } else {
      setLoginEmailError('');
    }

    // 2. Password validation
    if (!loginPassword) {
      setLoginPasswordError('يرجى إدخال كلمة المرور.');
      hasErrors = true;
      if (!firstErrorElementId) firstErrorElementId = 'field-login-password';
    } else {
      setLoginPasswordError('');
    }

    // Stop and scroll to first error if validation failed
    if (hasErrors) {
      if (firstErrorElementId) {
        const el = document.getElementById(firstErrorElementId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (el instanceof HTMLInputElement) {
            el.focus();
          }
        }
      }
      return;
    }

    setIsSubmitting(true);

    try {
      const authenticatedUser = await authService.login(cleanEmail, loginPassword);
      setIsSubmitting(false);
      onLoginSuccess(authenticatedUser);
      onShowToast(`أهلاً بعودتك يا ${authenticatedUser.name}! تم تسجيل الدخول بنجاح.`, 'success');
    } catch (err: any) {
      setIsSubmitting(false);
      if (err?.message === 'NOT_FOUND') {
        setError('هذا الحساب غير موجود، تأكد من البريد أو قم بإنشاء حساب جديد.');
      } else if (err?.message === 'INVALID_PASSWORD') {
        setError('كلمة المرور غير صحيحة، يرجى التحقق وإعادة المحاولة.');
      } else {
        setError('حدث خطأ أثناء تسجيل الدخول، يرجى المحاولة لاحقاً.');
      }
    }
  };

  // Handle Forgot Password Submit
  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');

    const cleanEmail = forgotEmail.trim();
    if (!cleanEmail || !isValidEmail(cleanEmail)) {
      setForgotError('يرجى إدخال بريد إلكتروني صحيح لاستعادة كلمة المرور.');
      return;
    }

    setIsSendingReset(true);
    try {
      const exists = await authService.requestPasswordReset(cleanEmail);
      setIsSendingReset(false);

      if (!exists) {
        setForgotError('هذا البريد الإلكتروني غير مسجل لدينا، يرجى التحقق من البريد أو إنشاء حساب جديد.');
        return;
      }

      setForgotSuccess(true);
      onShowToast(`تم إرسال رابط إعادة تعيين كلمة المرور إلى ${cleanEmail.toLowerCase()}`, 'success');
    } catch {
      setIsSendingReset(false);
      setForgotError('حدث خطأ أثناء معالجة الطلب، يرجى المحاولة لاحقاً.');
    }
  };

  return (
    <div className="w-full space-y-5 animate-fade-in font-['Cairo',sans-serif] px-3.5 py-4 bg-[#FAF8F5] min-h-[100dvh]" dir="rtl">
      
      {/* Main Login Container */}
      <main className="w-full flex flex-col justify-center">
        
        {/* Intro Header */}
        <div className="text-center mb-6 space-y-2">
          <h1 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
            تسجيل الدخول
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 max-w-md mx-auto leading-relaxed">
            أدخل بيانات حسابك للوصول إلى خدماتك وطلباتك بسهولة.
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-[2.5rem] border border-stone-200/80 shadow-xs overflow-hidden p-6 sm:p-8 relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl -mr-12 -mt-12" />
          
          {/* Error Notice */}
          {error && (
            <div className="mb-6 p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-black rounded-xl text-center flex items-center justify-center gap-2 animate-fade-in">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form noValidate onSubmit={handleLoginSubmit} className="space-y-4">
            
            {/* Email Field */}
            <div className="space-y-1.5">
              <label htmlFor="field-login-email" className="text-xs font-bold text-stone-700 mr-1">
                البريد الإلكتروني
              </label>
              <div className="relative group">
                <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 group-focus-within:text-emerald-700 transition-colors" />
                <input
                  id="field-login-email"
                  type="email"
                  dir="ltr"
                  value={loginEmail}
                  onChange={(e) => handleLoginEmailChange(e.target.value)}
                  onBlur={handleLoginEmailBlur}
                  placeholder="name@example.com"
                  className={`w-full bg-stone-50/60 border-2 rounded-2xl pr-11 pl-4 py-3.5 text-sm font-bold text-stone-900 focus:outline-none transition-all text-right ${
                    loginEmailError
                      ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-400 bg-rose-50/30'
                      : 'border-stone-200/60 focus:border-emerald-700 focus:bg-white focus:shadow-lg focus:shadow-emerald-700/5'
                  }`}
                />
              </div>
              {loginEmailError && (
                <p className="text-[11px] text-rose-600 font-bold mt-1 px-1 flex items-center gap-1 animate-fade-in">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{loginEmailError}</span>
                </p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-1">
                <label htmlFor="field-login-password" className="text-xs font-bold text-stone-700">
                  كلمة المرور
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(loginEmail.trim());
                    setForgotSuccess(false);
                    setForgotError('');
                    setShowForgotModal(true);
                  }}
                  className="text-[10px] text-emerald-700 font-black hover:underline cursor-pointer"
                >
                  نسيت كلمة المرور؟
                </button>
              </div>
              <div className="relative group">
                <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 group-focus-within:text-emerald-700 transition-colors" />
                <input
                  id="field-login-password"
                  type={showLoginPassword ? 'text' : 'password'}
                  dir="ltr"
                  value={loginPassword}
                  onChange={(e) => handleLoginPasswordChange(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full bg-stone-50/60 border-2 rounded-2xl pr-11 pl-12 py-3.5 text-sm font-bold text-stone-900 focus:outline-none transition-all text-right ${
                    loginPasswordError
                      ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-400 bg-rose-50/30'
                      : 'border-stone-200/60 focus:border-emerald-700 focus:bg-white focus:shadow-lg focus:shadow-emerald-700/5'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-2 text-stone-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition cursor-pointer"
                >
                  {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {loginPasswordError && (
                <p className="text-[11px] text-rose-600 font-bold mt-1 px-1 flex items-center gap-1 animate-fade-in">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{loginPasswordError}</span>
                </p>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-black py-4 rounded-2xl text-base transition shadow-lg shadow-emerald-700/20 active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <span className="animate-pulse">جاري التحقق...</span>
                ) : (
                  <>
                    <LogIn className="w-5 h-5 stroke-[2.5]" />
                    <span>تسجيل الدخول</span>
                  </>
                )}
              </button>
            </div>

            {/* Link to Register */}
            <div className="text-center pt-4 border-t border-stone-200/80 text-xs sm:text-sm text-stone-600 font-medium">
              <p>
                ليس لديك حساب في المنصة؟{' '}
                <button
                  type="button"
                  onClick={onNavigateToRegister}
                  className="text-emerald-700 font-extrabold hover:underline cursor-pointer"
                >
                  إنشاء حساب جديد
                </button>
              </p>
            </div>

          </form>

        </div>
      </main>

      {/* Forgot Password Modal Dialog */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-stone-200/80 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-stone-200/80">
              <div className="flex items-center gap-2 text-stone-900">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <KeyRound className="w-5 h-5" />
                </div>
                <h3 className="font-extrabold text-base sm:text-lg">استعادة كلمة المرور</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {forgotSuccess ? (
              <div className="text-center py-4 space-y-3">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="font-extrabold text-stone-900 text-sm sm:text-base">تم إرسال رابط الاستعادة!</h4>
                <p className="text-xs text-stone-500 leading-relaxed">
                  يرجى تفقد صندوق البريد الوارد أو مجلد الرسائل غير المرغوب فيها (Spam) للبريد <strong className="text-stone-700 font-bold">{forgotEmail}</strong> واتباع التعليمات لتعيين كلمة مرور جديدة.
                </p>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2.5 rounded-xl text-xs sm:text-sm transition mt-2 cursor-pointer"
                >
                  حسناً، فهمت
                </button>
              </div>
            ) : (
              <form noValidate onSubmit={handleForgotSubmit} className="space-y-4 pt-1">
                <p className="text-xs text-stone-500 leading-relaxed">
                  أدخل بريدك الإلكتروني المسجل وسنرسل لك رابطاً لإعادة تعيين كلمة المرور فوراً.
                </p>

                {forgotError && (
                  <p className="text-xs text-rose-600 font-bold bg-rose-50 p-2.5 rounded-xl flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{forgotError}</span>
                  </p>
                )}

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1.5">
                    البريد الإلكتروني المسجل
                  </label>
                  <div className="relative">
                    <Mail className="absolute right-3.5 top-3.5 w-4 h-4 text-stone-400" />
                    <input
                      type="email"
                      required
                      dir="ltr"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="email@example.com"
                      className="w-full bg-stone-50/60 border border-stone-200 rounded-xl pr-10 pl-3.5 py-2.5 text-xs sm:text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-emerald-700 focus:bg-white transition text-right"
                    />
                  </div>
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="flex-1 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold py-2.5 rounded-xl text-xs transition cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={isSendingReset}
                    className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isSendingReset ? 'جاري الإرسال...' : 'إرسال الرابط'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* End of content */}
    </div>
  );
};

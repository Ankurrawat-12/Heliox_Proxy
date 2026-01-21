'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, ArrowRight, Check, Sparkles, ArrowLeft, Mail } from 'lucide-react';
import { authApi, setAuthToken } from '@/lib/api';

const features = [
  '1,000 requests/day free',
  '2 API keys included',
  'Real-time analytics',
  'Automatic caching',
  'Rate limiting protection',
  'No credit card required',
];

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<'signup' | 'verify'>('signup');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    company_name: '',
  });
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authApi.signup(formData);
      setStep('verify');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste
      const digits = value.replace(/\D/g, '').slice(0, 6).split('');
      const newOtp = [...otp];
      digits.forEach((digit, i) => {
        if (index + i < 6) {
          newOtp[index + i] = digit;
        }
      });
      setOtp(newOtp);
      // Focus last filled or next empty
      const nextIndex = Math.min(index + digits.length, 5);
      document.getElementById(`otp-${nextIndex}`)?.focus();
    } else {
      const newOtp = [...otp];
      newOtp[index] = value.replace(/\D/g, '');
      setOtp(newOtp);
      // Auto-focus next input
      if (value && index < 5) {
        document.getElementById(`otp-${index + 1}`)?.focus();
      }
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      document.getElementById(`otp-${index - 1}`)?.focus();
    }
  };

  const handleVerify = async () => {
    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      setError('Please enter the 6-digit code');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = await authApi.verifyOtp(formData.email, otpCode);
      setAuthToken(response.access_token);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendLoading(true);
    setResendSuccess(false);
    setError('');

    try {
      await authApi.resendOtp(formData.email);
      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend code');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Features */}
      <div className="hidden lg:flex flex-1 bg-zinc-900 p-12 items-center justify-center relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500 rounded-full filter blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500 rounded-full filter blur-3xl" />
        </div>

        <div className="relative max-w-lg">
          <div className="flex items-center gap-2 mb-6">
            <Sparkles className="text-yellow-400" size={24} />
            <span className="text-yellow-400 font-medium">Free tier included</span>
          </div>

          <h2 className="text-4xl font-bold text-white mb-6">
            Start building with Heliox today
          </h2>
          <p className="text-xl text-zinc-400 mb-12">
            Get instant access to a production-ready API gateway. No setup fees, no hidden costs.
          </p>

          <div className="grid grid-cols-2 gap-4">
            {features.map((feature, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Check className="text-green-400" size={14} />
                </div>
                <span className="text-zinc-300">{feature}</span>
              </div>
            ))}
          </div>

          <div className="mt-12 p-6 bg-zinc-800/50 rounded-xl border border-zinc-700">
            <div className="flex items-center gap-6 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">JB</span>
                </div>
                <div>
                  <p className="text-white font-medium text-sm">Jay Bankoti</p>
                  <p className="text-zinc-500 text-xs">Founder</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">AR</span>
                </div>
                <div>
                  <p className="text-white font-medium text-sm">Ankur Rawat</p>
                  <p className="text-zinc-500 text-xs">Co-Founder</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">KG</span>
                </div>
                <div>
                  <p className="text-white font-medium text-sm">Kushagra Gupta</p>
                  <p className="text-zinc-500 text-xs">Co-Founder</p>
                </div>
              </div>
            </div>
            <p className="text-zinc-300 italic">
              "Building Heliox to make API management simple, fast, and reliable for developers everywhere."
            </p>
          </div>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-zinc-950">
        <div className="w-full max-w-md animate-fade-in">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <span className="text-white font-bold text-lg">H</span>
            </div>
            <span className="text-2xl font-bold text-white">Heliox</span>
          </div>

          {step === 'signup' ? (
            <>
              <h1 className="text-3xl font-bold text-white mb-2">Create your account</h1>
              <p className="text-zinc-400 mb-8">Start your free trial, no credit card required</p>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg mb-6">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Full name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input"
                    placeholder="John Doe"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Company name
                  </label>
                  <input
                    type="text"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    className="input"
                    placeholder="Acme Inc."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Work email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="input"
                    placeholder="you@company.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="input pr-12"
                      placeholder="••••••••"
                      minLength={8}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">Minimum 8 characters</p>
                </div>

                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="terms"
                    className="w-4 h-4 mt-1 rounded border-zinc-700 bg-zinc-900 text-indigo-600 focus:ring-indigo-500"
                    required
                  />
                  <label htmlFor="terms" className="text-sm text-zinc-400">
                    I agree to the{' '}
                    <Link href="/terms" className="text-indigo-400 hover:text-indigo-300">
                      Terms of Service
                    </Link>{' '}
                    and{' '}
                    <Link href="/privacy" className="text-indigo-400 hover:text-indigo-300">
                      Privacy Policy
                    </Link>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full btn-primary flex items-center justify-center gap-2 py-3"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      Create account
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </form>

              <p className="mt-8 text-center text-zinc-400">
                Already have an account?{' '}
                <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-medium">
                  Sign in
                </Link>
              </p>
            </>
          ) : (
            <>
              <button
                onClick={() => setStep('signup')}
                className="flex items-center gap-2 text-zinc-400 hover:text-white mb-6 transition-colors"
              >
                <ArrowLeft size={18} />
                Back
              </button>

              <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-6">
                <Mail className="text-indigo-400" size={32} />
              </div>

              <h1 className="text-3xl font-bold text-white mb-2">Verify your email</h1>
              <p className="text-zinc-400 mb-8">
                We've sent a 6-digit code to <span className="text-white font-medium">{formData.email}</span>
              </p>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg mb-6">
                  {error}
                </div>
              )}

              {resendSuccess && (
                <div className="bg-green-500/10 border border-green-500/20 text-green-400 px-4 py-3 rounded-lg mb-6">
                  Verification code sent! Check your inbox.
                </div>
              )}

              <div className="flex gap-3 justify-center mb-8">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    id={`otp-${index}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    className="w-12 h-14 text-center text-2xl font-bold bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                  />
                ))}
              </div>

              <button
                onClick={handleVerify}
                disabled={loading || otp.join('').length !== 6}
                className="w-full btn-primary flex items-center justify-center gap-2 py-3 mb-4"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    Verify & Continue
                    <ArrowRight size={18} />
                  </>
                )}
              </button>

              <p className="text-center text-zinc-400">
                Didn't receive the code?{' '}
                <button
                  onClick={handleResend}
                  disabled={resendLoading}
                  className="text-indigo-400 hover:text-indigo-300 font-medium disabled:opacity-50"
                >
                  {resendLoading ? 'Sending...' : 'Resend'}
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

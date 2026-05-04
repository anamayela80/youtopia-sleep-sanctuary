import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

const Index = lazy(() => import("./pages/Index.tsx"));
const Auth = lazy(() => import("./pages/Auth.tsx"));
const Onboarding = lazy(() => import("./pages/Onboarding.tsx"));
const Home = lazy(() => import("./pages/Home.tsx"));
const Settings = lazy(() => import("./pages/Settings.tsx"));
const Admin = lazy(() => import("./pages/Admin.tsx"));
const Practice = lazy(() => import("./pages/Practice.tsx"));
const MyMonth = lazy(() => import("./pages/MyMonth.tsx"));
const Reflect = lazy(() => import("./pages/Reflect.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const PreviewLoading = lazy(() => import("./pages/PreviewLoading.tsx"));
const HomePreview = lazy(() => import("./pages/HomePreview.tsx"));
const FlowPreview = lazy(() => import("./pages/FlowPreview.tsx"));
const PreviewVoiceCapture = lazy(() => import("./pages/PreviewVoiceCapture.tsx"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy.tsx"));
const TermsOfService = lazy(() => import("./pages/TermsOfService.tsx"));
const Logout = lazy(() => import("./pages/Logout.tsx"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/home" element={<Home />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/practice" element={<Practice />} />
            <Route path="/month" element={<MyMonth />} />
            <Route path="/reflect" element={<Reflect />} />
            <Route path="/preview-loading" element={<PreviewLoading />} />
            <Route path="/home-preview" element={<HomePreview />} />
            <Route path="/flow-preview" element={<FlowPreview />} />
            <Route path="/preview/voice-capture" element={<PreviewVoiceCapture />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/logout" element={<Logout />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

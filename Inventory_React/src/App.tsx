import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { IconSprite } from "./components/Icon";
import AppShell from "./components/layout/AppShell";
import { MovementDrawerProvider } from "./components/MovementDrawer";
import { PublicOnly, RequireAdmin, RequireAuth } from "./components/RouteGuards";
import { ConfirmProvider } from "./components/ui/ConfirmDialog";
import { AuthProvider } from "./context/AuthContext";
import { DataProvider } from "./context/DataContext";
import { ToastProvider } from "./context/ToastContext";
import { LoginPage, RegisterPage } from "./pages/AuthPages";
import CategoriesPage from "./pages/CategoriesPage";
import DashboardPage from "./pages/DashboardPage";
import { NotFoundPage } from "./pages/ErrorPages";
import MovementsPage from "./pages/MovementsPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import ProductFormPage from "./pages/ProductFormPage";
import ProductsPage from "./pages/ProductsPage";
import WarehousesPage from "./pages/WarehousesPage";

export default function App() {
    return (
        <BrowserRouter>
            <IconSprite />
            <ToastProvider>
                <AuthProvider>
                    <DataProvider>
                        <ConfirmProvider>
                            <MovementDrawerProvider>
                                <Routes>
                                    <Route element={<PublicOnly />}>
                                        <Route path="/login" element={<LoginPage />} />
                                        <Route path="/inscription" element={<RegisterPage />} />
                                    </Route>

                                    <Route element={<RequireAuth />}>
                                        <Route element={<AppShell />}>
                                            <Route index element={<DashboardPage />} />
                                            <Route path="produits" element={<ProductsPage />} />
                                            <Route path="produits/:id" element={<ProductDetailPage />} />
                                            <Route element={<RequireAdmin />}>
                                                <Route path="produits/nouveau" element={<ProductFormPage />} />
                                                <Route path="produits/:id/modifier" element={<ProductFormPage />} />
                                            </Route>
                                            <Route path="mouvements" element={<MovementsPage />} />
                                            <Route path="categories" element={<CategoriesPage />} />
                                            <Route path="entrepots" element={<WarehousesPage />} />
                                            <Route path="*" element={<NotFoundPage />} />
                                        </Route>
                                    </Route>

                                    {/* Paths of the previous version of the app */}
                                    <Route path="/Product_List" element={<Navigate to="/produits" replace />} />
                                    <Route path="/Product_Add" element={<Navigate to="/produits/nouveau" replace />} />
                                </Routes>
                            </MovementDrawerProvider>
                        </ConfirmProvider>
                    </DataProvider>
                </AuthProvider>
            </ToastProvider>
        </BrowserRouter>
    );
}

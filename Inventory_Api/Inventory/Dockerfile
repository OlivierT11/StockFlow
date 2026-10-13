# Utilise l’image Docker officielle d’ASP.NET Core 10 pour exécuter l’application.
# sdk:10.0 contient tout le SDK, y compris les outils de compilation, tandis que "final" est basé sur l’image runtime (aspnet:10.0) plus légère.
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build

# Définit le répertoire de travail dans le conteneur
WORKDIR /src

# Copie le fichier projet depuis le la machine locale vers le répertoire courant du conteneur
COPY Inventory.csproj ./

# Télécharge et restaure les dépendances NuGet définies dans Inventory.csproj.
RUN dotnet restore ./Inventory.csproj

# Copie tous les fichiers du projet depuis la machine locale vers le répertoire courant du conteneur
COPY . .

# Compile le projet en mode Release et publie les fichiers de sortie dans le répertoire /app/publish du conteneur.
RUN dotnet publish ./Inventory.csproj \
    -c Release \
    -o /app/publish \
    --no-restore

# Multi-stage build qui permet d’obtenir une image de production plus petite et plus propre, en ne mettant ni le SDK ni les outils de compilation dans l'image finale.
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final

WORKDIR /app

# Mettre dans l'image docker le resultat du build .NET, c-a-d les dll, non les fichiers source .cs
# De plus, copier uniquement le dossier /publish de l'étape précédente permet de ne pas inclure les outils de compilation (SDK, compiler...) dans l'image finale.
COPY --from=build /app/publish .

# Configure l'application pour écouter sur le port 8080.
ENV ASPNETCORE_URLS=http://+:8080

# Indique à Docker que le conteneur écoute sur le port 8080.
EXPOSE 8080

# Définit le point d'entrée du conteneur pour exécuter l'application Inventory.dll avec le runtime .NET.
ENTRYPOINT ["dotnet", "Inventory.dll"]
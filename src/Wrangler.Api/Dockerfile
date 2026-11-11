FROM mcr.microsoft.com/dotnet/aspnet:11.0
WORKDIR /app
EXPOSE 8080
EXPOSE 8081

COPY ./publish .
ENTRYPOINT ["dotnet", "Asm.Wrangler.Api.dll"]

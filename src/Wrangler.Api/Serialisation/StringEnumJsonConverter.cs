using System.Text.Json;
using System.Text.Json.Serialization;
using Octokit;

namespace Asm.Wrangler.Api.Serialisation;

/// <summary>
/// JSON converter that serialises Octokit <see cref="StringEnum{T}"/> values as plain strings.
/// </summary>
/// <typeparam name="T">The underlying enum type.</typeparam>
public class StringEnumJsonConverter<T> : JsonConverter<StringEnum<T>> where T : struct, Enum
{
    /// <inheritdoc />
    public override StringEnum<T> Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var value = reader.GetString();
        return new StringEnum<T>(value ?? String.Empty);
    }

    /// <inheritdoc />
    public override void Write(Utf8JsonWriter writer, StringEnum<T> value, JsonSerializerOptions options)
    {
        // Handle null or empty values gracefully
        var stringValue = value.StringValue ?? String.Empty;
        writer.WriteStringValue(stringValue);
    }
}

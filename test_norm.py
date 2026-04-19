import unicodedata
print("Normalize NFKC:", unicodedata.normalize('NFKC', "k∈R olmak üzere, ∫ 𝑘 𝑑 𝑥 = 𝑘 𝑥 + 𝐶 ∫k dx=kx+C"))
print("Normalize NFD:", unicodedata.normalize('NFD', "ü"))

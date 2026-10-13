using Inventory.Data;
using Inventory.DTOs;
using Inventory.Models;
using Inventory.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace Inventory.Services
{
    public class ProductService : IProductService
    {
        private readonly IProductRepository _productRepository;

        public ProductService(IProductRepository productRepository)
        {
            _productRepository = productRepository;
        }

        public async Task<List<ProductResponseDto>> GetAllAsync(CancellationToken cancellationToken = default)
        {

            var products = await _productRepository.GetAllAsync(cancellationToken);
            return products.Select(p => new ProductResponseDto
            {
                Id = p.Id,
                Name = p.Name,
                Price = p.Price,
                Stock = p.Stock
            }).ToList();
        }

        public async Task<ProductListDto> GetWithPagerAsync(ProductSearchQueryDto query, CancellationToken cancellationToken = default)
        {
            return await _productRepository.GetWithPagerAsync(query, cancellationToken);
        }

        public async Task<ProductResponseDto?> GetByIdAsync(int id, CancellationToken cancellationToken = default)
        {

            var product = await _productRepository.GetByIdAsync(id, cancellationToken);
            if (product == null)
            {
                return null;
            }

            return new ProductResponseDto
            {
                Id = product.Id,
                Name = product.Name,
                Price = product.Price,
                Stock = product.Stock
            };
        }

        public async Task<ProductResponseDto> CreateAsync(ProductCreateDto dto, CancellationToken cancellationToken = default)
        {
            var product = new Product
            {
                Name = dto.Name,
                Price = dto.Price,
                Stock = dto.Stock
            };

            var createdProduct = await _productRepository.CreateAsync(product, cancellationToken);

            return new ProductResponseDto
            {
                Id = createdProduct.Id,
                Name = createdProduct.Name,
                Price = createdProduct.Price,
                Stock = createdProduct.Stock
            };
        }

        public async Task<bool> UpdateAsync(int id, ProductUpdateDto dto, CancellationToken cancellationToken = default)
        {
            var product = new Product
            {
                Id = id,
                Name = dto.Name,
                Price = dto.Price,
                Stock = dto.Stock
            };

            return await _productRepository.UpdateAsync(id, product, cancellationToken);
        }

        public async Task<bool> DeleteAsync(int id, CancellationToken cancellationToken = default)
        {
            return await _productRepository.DeleteAsync(id, cancellationToken);
        }
    }
}

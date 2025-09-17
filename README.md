# FlyMine OpenAPI Specification

## BioHackathon 2025 Project

This repository contains the OpenAPI specification for [FlyMine](https://www.flymine.org/flymine/), an integrated database for *Drosophila* genomics, developed as part of the [BioHackathon 2025](https://2025.biohackathon.org).

## Overview

FlyMine is a powerful integrated database providing access to genomic, proteomic, and genetic data for *Drosophila melanogaster* and related organisms. This OpenAPI specification documents FlyMine's RESTful web services API, making it easier for developers and researchers to integrate FlyMine data into their applications and workflows.

## Project Goals

- **Standardize API Documentation**: Create a comprehensive OpenAPI 3.0 specification for FlyMine web services
- **Enable SmartAPI Integration**: Make FlyMine discoverable through [SmartAPI](https://smart-api.info/) registry
- **Improve Interoperability**: Facilitate integration with other bioinformatics tools and databases
- **Support FAIR Principles**: Enhance Findability, Accessibility, Interoperability, and Reusability of FlyMine data

## Features

The OpenAPI specification covers:

- **Query Services**: Execute PathQuery queries for flexible data retrieval
- **Template Queries**: Use pre-configured query templates for common use cases
- **List Management**: Create and manage lists of biological entities
- **Search Functionality**: Keyword-based search across FlyMine data
- **Data Export**: Export data in multiple formats (JSON, XML, TSV, CSV, GFF3, FASTA)
- **Authentication**: Token-based authentication for user-specific operations

## Files

- `flymine-openapi.yaml` - Complete OpenAPI 3.0.3 specification for FlyMine API
- `README.md` - This documentation file

## Usage

### View the Specification

You can view and interact with the API specification using the [Swagger Editor](https://editor.swagger.io/):

1. Go to https://editor.swagger.io/
2. Copy the contents of `flymine-openapi.yaml`
3. Paste into the editor to see the interactive documentation

### API Base URL

```
https://www.flymine.org/flymine/service
```

### Example Query

Execute a simple gene query:

```bash
curl -X POST "https://www.flymine.org/flymine/service/query/results" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d 'query=<query model="genomic" view="Gene.primaryIdentifier Gene.symbol">
        <constraint path="Gene.organism.name" op="=" value="Drosophila melanogaster"/>
        <constraint path="Gene.symbol" op="=" value="zen"/>
      </query>&format=json'
```

## SmartAPI Integration

This specification is designed to be registered with [SmartAPI](https://smart-api.info/), a registry for APIs in the biomedical domain. SmartAPI registration enables:

- Enhanced discoverability of FlyMine services
- Integration with biomedical data discovery tools
- Standardized API metadata following FAIR principles

## Resources

- **FlyMine**: https://www.flymine.org/flymine/
- **InterMine Documentation**: http://intermine.org/im-docs/docs/web-services/
- **OpenAPI Specification**: https://swagger.io/specification/
- **SmartAPI Registry**: https://smart-api.info/
- **BioHackathon 2025**: https://2025.biohackathon.org/

## Technologies

- **OpenAPI**: Version 3.0.3 specification standard
- **InterMine**: The data warehouse system powering FlyMine
- **SmartAPI**: API registry for biomedical APIs

## Contributing

This project was developed during BioHackathon 2025. For contributions or issues:

1. Fork the repository
2. Create a feature branch
3. Submit a pull request with your improvements

## License

FlyMine is released under the [LGPL-2.1 License](https://www.gnu.org/licenses/old-licenses/lgpl-2.1.en.html).

## Contact

- **FlyMine Support**: info@flymine.org
- **FlyMine Homepage**: https://www.flymine.org/flymine/
- **InterMine Project**: http://intermine.org/

## Acknowledgments

This project was developed as part of BioHackathon 2025, bringing together developers and researchers to improve interoperability in bioinformatics tools and databases.

---

*Last Updated: BioHackathon 2025*